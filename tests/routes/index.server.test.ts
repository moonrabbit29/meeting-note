import { describe, expect, it } from 'vitest';

describe('/ server load', () => {
	it('redirects unauthenticated users to login', async () => {
		const { load } = await import('../../src/routes/+page.server');

		await expect(load({ locals: { account: null } } as never)).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	it('redirects authenticated users to calendar', async () => {
		const { load } = await import('../../src/routes/+page.server');

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