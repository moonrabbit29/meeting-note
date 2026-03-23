import { describe, expect, it } from 'vitest';

describe('/login server load', () => {
	it('allows unauthenticated users to see the login page', async () => {
		const { load } = await import('../../src/routes/login/+page.server');

		await expect(load({ locals: { account: null } } as never)).resolves.toEqual({});
	});

	it('redirects authenticated users to calendar', async () => {
		const { load } = await import('../../src/routes/login/+page.server');

		await expect(
			load({
				locals: {
					account: {
						id: 1,
						email: 'employee@example.com',
						name: 'Employee',
						role: 'employee',
						isOwner: false,
						isActive: true,
						createdAt: '2026-03-16 10:00:00',
						updatedAt: '2026-03-16 10:00:00'
					}
				}
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/calendar' });
	});
});