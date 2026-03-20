import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearAuthCookie = vi.fn();
const readAuthenticatedAccount = vi.fn();

vi.mock('$lib/server/auth', () => ({
	clearAuthCookie,
	readAuthenticatedAccount
}));

describe('hooks.server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('allows public routes without authentication', async () => {
		readAuthenticatedAccount.mockResolvedValueOnce(null);
		const { handle } = await import('../src/hooks.server');
		const resolve = vi.fn().mockResolvedValue(new Response('ok'));

		const response = await handle({
			event: {
				url: new URL('http://localhost/'),
				request: new Request('http://localhost/'),
				cookies: { delete: vi.fn() },
				locals: {}
			},
			resolve
		} as never);

		expect(resolve).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	it('returns 401 for protected api routes without authentication', async () => {
		readAuthenticatedAccount.mockResolvedValueOnce(null);
		const { handle } = await import('../src/hooks.server');

		const response = await handle({
			event: {
				url: new URL('http://localhost/api/form-submission'),
				request: new Request('http://localhost/api/form-submission'),
				cookies: { delete: vi.fn() },
				locals: {}
			},
			resolve: vi.fn()
		} as never);
		const body = await response.json();

		expect(clearAuthCookie).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(401);
		expect(body).toEqual({ error: 'Authentication required' });
	});

	it('redirects protected pages without authentication', async () => {
		readAuthenticatedAccount.mockResolvedValueOnce(null);
		const { handle } = await import('../src/hooks.server');

		await expect(
			handle({
				event: {
					url: new URL('http://localhost/form-laporan'),
					request: new Request('http://localhost/form-laporan'),
					cookies: { delete: vi.fn() },
					locals: {}
				},
				resolve: vi.fn()
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/login' });
	});

	it('allows protected routes for authenticated users', async () => {
		readAuthenticatedAccount.mockResolvedValueOnce({
			id: 1,
			email: 'employee@example.com',
			name: 'Employee',
			role: 'employee',
			isOwner: false,
			isActive: true,
			createdAt: '2026-03-16 10:00:00',
			updatedAt: '2026-03-16 10:00:00'
		});
		const { handle } = await import('../src/hooks.server');
		const resolve = vi.fn().mockResolvedValue(new Response('ok'));
		const locals: Record<string, unknown> = {};

		const response = await handle({
			event: {
				url: new URL('http://localhost/list-laporan'),
				request: new Request('http://localhost/list-laporan'),
				cookies: { delete: vi.fn() },
				locals
			},
			resolve
		} as never);

		expect(resolve).toHaveBeenCalledTimes(1);
		expect(locals.account).toMatchObject({ email: 'employee@example.com' });
		expect(response.status).toBe(200);
	});
});