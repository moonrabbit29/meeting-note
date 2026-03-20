import { json, type RequestHandler } from '@sveltejs/kit';

import { AuthApiError, clearAuthCookie, logoutAccount } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		await logoutAccount(request);
		clearAuthCookie(cookies);

		return json({ message: 'Logged out successfully' });
	} catch (error) {
		if (error instanceof AuthApiError) {
			return json({ error: error.message }, { status: error.status });
		}

		const message = error instanceof Error ? error.message : 'Unable to log out';

		return json({ error: message }, { status: 500 });
	}
};