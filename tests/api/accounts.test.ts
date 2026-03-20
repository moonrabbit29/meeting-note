import { beforeEach, describe, expect, it, vi } from 'vitest';

const bootstrapOwnerAccount = vi.fn();
const setAuthCookie = vi.fn();
const createManagedAccount = vi.fn();
const listManagedAccounts = vi.fn();
const requireOwnerAccount = vi.fn();
const requireSystemAdministratorAccount = vi.fn();
const updateManagedAccountStatus = vi.fn();

class MockAuthApiError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

vi.mock('$lib/server/auth', () => ({
	AuthApiError: MockAuthApiError,
	bootstrapOwnerAccount,
	setAuthCookie,
	createManagedAccount,
	listManagedAccounts,
	requireOwnerAccount,
	requireSystemAdministratorAccount,
	updateManagedAccountStatus
}));

describe('account management APIs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates the owner account', async () => {
		bootstrapOwnerAccount.mockResolvedValueOnce({
			account: {
				id: 1,
				email: 'owner@example.com',
				name: 'Owner',
				role: 'SystemAdministrator',
				isOwner: true,
				isActive: true,
				createdAt: '2026-03-16 10:00:00',
				updatedAt: '2026-03-16 10:00:00'
			},
			token: 'owner-token',
			expiresAt: '2026-03-23T10:00:00.000Z'
		});

		const { POST } = await import('../../src/routes/api/accounts/owner/+server');
		const cookies = { set: vi.fn(), delete: vi.fn() };
		const response = await POST({
			request: new Request('http://localhost/api/accounts/owner', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: 'Owner',
					email: 'owner@example.com',
					password: 'supersecret'
				})
			}),
			cookies
		} as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(bootstrapOwnerAccount).toHaveBeenCalledTimes(1);
		expect(setAuthCookie).toHaveBeenCalledTimes(1);
		expect(body.token).toBe('owner-token');
	});

	it('lists accounts for the owner account', async () => {
		requireOwnerAccount.mockResolvedValueOnce({ id: 1, isOwner: true });
		listManagedAccounts.mockResolvedValueOnce([
			{
				id: 2,
				email: 'employee@example.com',
				name: 'Employee',
				role: 'employee',
				isOwner: false,
				isActive: true,
				createdAt: '2026-03-16 10:00:00',
				updatedAt: '2026-03-16 10:00:00'
			}
		]);

		const { GET } = await import('../../src/routes/api/accounts/+server');
		const response = await GET({
			request: new Request('http://localhost/api/accounts', {
				headers: { authorization: 'Bearer owner-token' }
			})
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(requireOwnerAccount).toHaveBeenCalledTimes(1);
		expect(body.accounts).toHaveLength(1);
	});

	it('creates a new managed account through signup', async () => {
		requireSystemAdministratorAccount.mockResolvedValueOnce({ id: 1, role: 'SystemAdministrator', isOwner: true });
		createManagedAccount.mockResolvedValueOnce({
			id: 3,
			email: 'admin@example.com',
			name: 'Admin User',
			role: 'SystemAdministrator',
			isOwner: false,
			isActive: true,
			createdAt: '2026-03-16 11:00:00',
			updatedAt: '2026-03-16 11:00:00'
		});

		const { POST } = await import('../../src/routes/api/signup/+server');
		const response = await POST({
			request: new Request('http://localhost/api/signup', {
				method: 'POST',
				headers: {
					authorization: 'Bearer owner-token',
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					name: 'Admin User',
					email: 'admin@example.com',
					password: 'supersecret',
					role: 'SystemAdministrator'
				})
			})
		} as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(createManagedAccount).toHaveBeenCalledTimes(1);
		expect(body.account.role).toBe('SystemAdministrator');
	});

	it('updates account active state', async () => {
		requireOwnerAccount.mockResolvedValueOnce({ id: 1, isOwner: true });
		updateManagedAccountStatus.mockResolvedValueOnce({
			id: 4,
			email: 'user@example.com',
			name: 'User',
			role: 'employee',
			isOwner: false,
			isActive: false,
			createdAt: '2026-03-16 12:00:00',
			updatedAt: '2026-03-16 12:30:00'
		});

		const { PATCH } = await import('../../src/routes/api/accounts/[accountId]/+server');
		const response = await PATCH({
			params: { accountId: '4' },
			request: new Request('http://localhost/api/accounts/4', {
				method: 'PATCH',
				headers: {
					authorization: 'Bearer owner-token',
					'content-type': 'application/json'
				},
				body: JSON.stringify({ isActive: false })
			})
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(updateManagedAccountStatus).toHaveBeenCalledWith(4, false, { id: 1, isOwner: true });
		expect(body.account.isActive).toBe(false);
	});

	it('maps auth errors to the response status', async () => {
		requireOwnerAccount.mockRejectedValueOnce(new MockAuthApiError(401, 'Missing bearer token'));

		const { GET } = await import('../../src/routes/api/accounts/+server');
		const response = await GET({
			request: new Request('http://localhost/api/accounts')
		} as never);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ error: 'Missing bearer token' });
	});
});