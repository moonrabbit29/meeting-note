import { json, type RequestHandler } from '@sveltejs/kit';

import { AuthApiError, loginAccount, setAuthCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const payload = await request.json();
		const result = await loginAccount(payload ?? {});
		setAuthCookie(cookies, result.token, result.expiresAt);

		return json({
			...result,
			session: {
				role: result.account.role,
				employeeId: result.account.id
			}
		});
	} catch (error) {
		if (error instanceof AuthApiError) {
			return json({ error: error.message }, { status: error.status });
		}

		console.error(error);
		return json({ error: 'Unable to log in' }, { status: 500 });
	}
};