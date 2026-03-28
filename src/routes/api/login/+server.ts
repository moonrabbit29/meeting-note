import { json, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import { loginAccount, setAuthCookie } from '$lib/server/auth';

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
		const mappedError = mapApiError(error, 'Unable to log in');
		logApiError('api.login.post', error);
		return json({ error: mappedError.message }, { status: mappedError.status });
	}
};