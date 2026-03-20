import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginAccount = vi.fn();
const setAuthCookie = vi.fn();

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
	loginAccount,
	setAuthCookie
}));

describe('/api/login', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('logs in with valid credentials', async () => {
		loginAccount.mockResolvedValueOnce({
			account: {
				id: 2,
				email: 'employee@example.com',
				name: 'Employee',
				role: 'employee',
				isOwner: false,
				isActive: true,
				createdAt: '2026-03-16 10:00:00',
				updatedAt: '2026-03-16 10:00:00'
			},
			token: 'session-token',
			expiresAt: '2026-03-23T10:00:00.000Z'
		});

		const { POST } = await import('../../src/routes/api/login/+server');
		const cookies = { set: vi.fn(), delete: vi.fn() };
		const response = await POST({
			request: new Request('http://localhost/api/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: 'employee@example.com',
					password: 'supersecret'
				})
			}),
			cookies
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(loginAccount).toHaveBeenCalledTimes(1);
		expect(setAuthCookie).toHaveBeenCalledTimes(1);
		expect(body.token).toBe('session-token');
		expect(body.session).toEqual({
			role: 'employee',
			employeeId: 2
		});
	});

	it('maps invalid credentials to 401', async () => {
		loginAccount.mockRejectedValueOnce(new MockAuthApiError(401, 'Invalid email or password'));

		const { POST } = await import('../../src/routes/api/login/+server');
		const response = await POST({
			request: new Request('http://localhost/api/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: 'employee@example.com',
					password: 'wrongpass'
				})
			})
		} as never);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ error: 'Invalid email or password' });
	});
});