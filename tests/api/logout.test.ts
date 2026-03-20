import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearAuthCookie = vi.fn();
const logoutAccount = vi.fn();

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
	clearAuthCookie,
	logoutAccount
}));

describe('/api/logout', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('revokes the current session and clears the cookie', async () => {
		const { POST } = await import('../../src/routes/api/logout/+server');
		const cookies = { set: vi.fn(), delete: vi.fn() };
		const response = await POST({
			request: new Request('http://localhost/api/logout', {
				method: 'POST',
				headers: { authorization: 'Bearer token' }
			}),
			cookies
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(logoutAccount).toHaveBeenCalledTimes(1);
		expect(clearAuthCookie).toHaveBeenCalledTimes(1);
		expect(body).toEqual({ message: 'Logged out successfully' });
	});

	it('maps auth failures to the response status', async () => {
		logoutAccount.mockRejectedValueOnce(new MockAuthApiError(401, 'Missing authentication token'));

		const { POST } = await import('../../src/routes/api/logout/+server');
		const response = await POST({
			request: new Request('http://localhost/api/logout', {
				method: 'POST'
			}),
			cookies: { set: vi.fn(), delete: vi.fn() }
		} as never);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ error: 'Missing authentication token' });
	});
});