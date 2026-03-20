import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import type { AccountRow } from '$lib/server/repositories/accounts';
import { accounts } from '$lib/server/schema/accounts';
import { authSessions } from '$lib/server/schema/auth-sessions';

export type AuthSessionRow = typeof authSessions.$inferSelect;
export type AuthSessionWithAccountRow = {
	session: AuthSessionRow;
	account: AccountRow;
};

export async function insertAuthSession(values: {
	accountId: number;
	tokenHash: string;
	expiresAt: string;
}): Promise<AuthSessionRow> {
	const [insertedRow] = await db.insert(authSessions).values(values).returning();

	if (!insertedRow) {
		throw new Error('Unable to retrieve created auth session');
	}

	return insertedRow;
}

export async function findAuthSessionWithAccountByTokenHash(
	tokenHash: string
): Promise<AuthSessionWithAccountRow | undefined> {
	const [row] = await db
		.select({
			session: authSessions,
			account: accounts
		})
		.from(authSessions)
		.innerJoin(accounts, eq(authSessions.accountId, accounts.id))
		.where(eq(authSessions.tokenHash, tokenHash));

	return row;
}

export async function revokeAuthSession(sessionId: number, revokedAt: string): Promise<void> {
	await db
		.update(authSessions)
		.set({ revokedAt })
		.where(eq(authSessions.id, sessionId));
}