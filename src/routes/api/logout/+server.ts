import { json, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import { clearAuthCookie, logoutAccount } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		await logoutAccount(request);
		clearAuthCookie(cookies);

		return json({ message: 'Logged out successfully' });
	} catch (error) {
		const mappedError = mapApiError(error, 'Unable to log out');
		logApiError('api.logout.post', error);
		return json({ error: mappedError.message }, { status: mappedError.status });
	}
};