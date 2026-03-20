import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { Cookies } from '@sveltejs/kit';

import {
	countOwnerAccounts,
	findAccountByEmail,
	findAccountById,
	insertAccount,
	listAccountRows,
	updateAccountActiveState,
	type AccountRow
} from '$lib/server/repositories/accounts';
import {
	findAuthSessionWithAccountByTokenHash,
	insertAuthSession,
	revokeAuthSession
} from '$lib/server/repositories/auth-sessions';
import type { AccountRole } from '$lib/server/schema/accounts';

const scryptAsync = promisify(scrypt);
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

export const AUTH_COOKIE_NAME = 'meeting_note_session';

export class AuthApiError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'AuthApiError';
	}
}

export type PublicAccount = {
	id: number;
	email: string;
	name: string;
	role: AccountRole;
	isOwner: boolean;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
};

type SessionResult = {
	token: string;
	expiresAt: string;
};

type AuthenticatedSession = {
	sessionId: number;
	account: PublicAccount;
	expiresAt: string;
};

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function ensureNonEmptyString(value: unknown, fieldName: string): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new AuthApiError(400, `${fieldName} is required`);
	}

	return value.trim();
}

function ensureAccountRole(value: unknown): AccountRole {
	if (value !== 'SystemAdministrator' && value !== 'employee') {
		throw new AuthApiError(400, 'Role must be either SystemAdministrator or employee');
	}

	return value;
}

function ensureValidEmail(email: string): string {
	const normalizedEmail = normalizeEmail(email);

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
		throw new AuthApiError(400, 'Email address is invalid');
	}

	return normalizedEmail;
}

function ensureValidPassword(password: string): string {
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new AuthApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
	}

	return password;
}

function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function parseCookies(cookieHeader: string | null): Map<string, string> {
	const cookies = new Map<string, string>();

	if (!cookieHeader) {
		return cookies;
	}

	for (const part of cookieHeader.split(';')) {
		const trimmedPart = part.trim();

		if (!trimmedPart) {
			continue;
		}

		const separatorIndex = trimmedPart.indexOf('=');

		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmedPart.slice(0, separatorIndex).trim();
		const value = trimmedPart.slice(separatorIndex + 1).trim();

		cookies.set(key, decodeURIComponent(value));
	}

	return cookies;
}

function getBaseAuthCookieOptions(): Parameters<Cookies['set']>[2] {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	};
}

function readSessionToken(request: Request): string | null {
	const authorizationHeader = request.headers.get('authorization') ?? '';
	const [scheme, bearerToken] = authorizationHeader.split(' ');

	if (scheme?.toLowerCase() === 'bearer' && bearerToken) {
		return bearerToken;
	}

	return parseCookies(request.headers.get('cookie')).get(AUTH_COOKIE_NAME) ?? null;
}

function createSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

	return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [salt, expectedHash] = storedHash.split(':');

	if (!salt || !expectedHash) {
		return false;
	}

	const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
	const expectedBuffer = Buffer.from(expectedHash, 'hex');

	if (expectedBuffer.length !== derivedKey.length) {
		return false;
	}

	return timingSafeEqual(expectedBuffer, derivedKey);
}

function toPublicAccount(account: AccountRow): PublicAccount {
	return {
		id: account.id,
		email: account.email,
		name: account.name,
		role: account.role,
		isOwner: account.isOwner,
		isActive: account.isActive,
		createdAt: account.createdAt,
		updatedAt: account.updatedAt
	};
}

async function requireAuthenticatedSession(request: Request): Promise<AuthenticatedSession> {
	const token = readSessionToken(request);

	if (!token) {
		throw new AuthApiError(401, 'Missing authentication token');
	}

	const sessionRecord = await findAuthSessionWithAccountByTokenHash(hashSessionToken(token));

	if (!sessionRecord) {
		throw new AuthApiError(401, 'Invalid authentication token');
	}

	if (sessionRecord.session.revokedAt) {
		throw new AuthApiError(401, 'Authentication token has been revoked');
	}

	if (new Date(sessionRecord.session.expiresAt).getTime() <= Date.now()) {
		await revokeAuthSession(sessionRecord.session.id, new Date().toISOString());
		throw new AuthApiError(401, 'Authentication token has expired');
	}

	if (!sessionRecord.account.isActive) {
		throw new AuthApiError(403, 'Account is deactivated');
	}

	return {
		sessionId: sessionRecord.session.id,
		account: toPublicAccount(sessionRecord.account),
		expiresAt: sessionRecord.session.expiresAt
	};
}

async function ensureEmailAvailable(email: string): Promise<void> {
	const existingAccount = await findAccountByEmail(email);

	if (existingAccount) {
		throw new AuthApiError(409, 'An account with this email already exists');
	}
}

async function createSession(accountId: number): Promise<SessionResult> {
	const token = createSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

	await insertAuthSession({
		accountId,
		tokenHash: hashSessionToken(token),
		expiresAt
	});

	return { token, expiresAt };
}

export async function bootstrapOwnerAccount(input: {
	name: unknown;
	email: unknown;
	password: unknown;
}): Promise<{ account: PublicAccount; token: string; expiresAt: string }> {
	if ((await countOwnerAccounts()) > 0) {
		throw new AuthApiError(409, 'Owner account already exists');
	}

	const name = ensureNonEmptyString(input.name, 'Name');
	const email = ensureValidEmail(ensureNonEmptyString(input.email, 'Email'));
	const password = ensureValidPassword(ensureNonEmptyString(input.password, 'Password'));

	await ensureEmailAvailable(email);

	const account = await insertAccount({
		name,
		email,
		passwordHash: await hashPassword(password),
		role: 'SystemAdministrator',
		isOwner: true,
		isActive: true
	});
	const session = await createSession(account.id);

	return {
		account: toPublicAccount(account),
		token: session.token,
		expiresAt: session.expiresAt
	};
}

export async function loginAccount(input: {
	email: unknown;
	password: unknown;
}): Promise<{ account: PublicAccount; token: string; expiresAt: string }> {
	const email = ensureValidEmail(ensureNonEmptyString(input.email, 'Email'));
	const password = ensureNonEmptyString(input.password, 'Password');
	const account = await findAccountByEmail(email);

	if (!account || !(await verifyPassword(password, account.passwordHash))) {
		throw new AuthApiError(401, 'Invalid email or password');
	}

	if (!account.isActive) {
		throw new AuthApiError(403, 'Account is deactivated');
	}

	const session = await createSession(account.id);

	return {
		account: toPublicAccount(account),
		token: session.token,
		expiresAt: session.expiresAt
	};
}

export function setAuthCookie(cookies: Cookies, token: string, expiresAt: string): void {
	cookies.set(AUTH_COOKIE_NAME, token, {
		...getBaseAuthCookieOptions(),
		expires: new Date(expiresAt)
	});
}

export function clearAuthCookie(cookies: Cookies): void {
	cookies.delete(AUTH_COOKIE_NAME, getBaseAuthCookieOptions());
}

export async function readAuthenticatedAccount(request: Request): Promise<PublicAccount | null> {
	try {
		const session = await requireAuthenticatedSession(request);

		return session.account;
	} catch (error) {
		if (error instanceof AuthApiError && (error.status === 401 || error.status === 403)) {
			return null;
		}

		throw error;
	}
}

export async function requireAuthenticatedAccount(request: Request): Promise<PublicAccount> {
	const session = await requireAuthenticatedSession(request);

	return session.account;
}

export async function requireOwnerAccount(request: Request): Promise<PublicAccount> {
	const session = await requireAuthenticatedSession(request);

	if (!session.account.isOwner) {
		throw new AuthApiError(403, 'Only the owner account can perform this action');
	}

	return session.account;
}

export async function requireSystemAdministratorAccount(request: Request): Promise<PublicAccount> {
	const session = await requireAuthenticatedSession(request);

	if (session.account.role !== 'SystemAdministrator') {
		throw new AuthApiError(403, 'Only a SystemAdministrator can perform this action');
	}

	return session.account;
}

export async function logoutAccount(request: Request): Promise<void> {
	const session = await requireAuthenticatedSession(request);

	await revokeAuthSession(session.sessionId, new Date().toISOString());
}

export async function createManagedAccount(
	input: {
		name: unknown;
		email: unknown;
		password: unknown;
		role: unknown;
	},
	actor: PublicAccount
): Promise<PublicAccount> {
	if (actor.role !== 'SystemAdministrator') {
		throw new AuthApiError(403, 'Only a SystemAdministrator can create users');
	}

	const name = ensureNonEmptyString(input.name, 'Name');
	const email = ensureValidEmail(ensureNonEmptyString(input.email, 'Email'));
	const password = ensureValidPassword(ensureNonEmptyString(input.password, 'Password'));
	const role = ensureAccountRole(input.role);

	await ensureEmailAvailable(email);

	const account = await insertAccount({
		name,
		email,
		passwordHash: await hashPassword(password),
		role,
		isOwner: false,
		isActive: true
	});

	return toPublicAccount(account);
}

export async function listManagedAccounts(actor: PublicAccount): Promise<PublicAccount[]> {
	if (!actor.isOwner) {
		throw new AuthApiError(403, 'Only the owner account can view users');
	}

	const accounts = await listAccountRows();

	return accounts.map(toPublicAccount);
}

export async function updateManagedAccountStatus(
	accountId: number,
	isActive: unknown,
	actor: PublicAccount
): Promise<PublicAccount> {
	if (!actor.isOwner) {
		throw new AuthApiError(403, 'Only the owner account can change account status');
	}

	if (!Number.isInteger(accountId) || accountId <= 0) {
		throw new AuthApiError(400, 'Account id must be a positive integer');
	}

	if (typeof isActive !== 'boolean') {
		throw new AuthApiError(400, 'isActive must be a boolean');
	}

	const existingAccount = await findAccountById(accountId);

	if (!existingAccount) {
		throw new AuthApiError(404, 'Account not found');
	}

	if (existingAccount.isOwner) {
		throw new AuthApiError(400, 'Owner account cannot be deactivated');
	}

	const updatedAccount = await updateAccountActiveState(accountId, isActive);

	return toPublicAccount(updatedAccount);
}