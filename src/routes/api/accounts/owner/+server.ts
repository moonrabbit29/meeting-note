import { json, type RequestHandler } from '@sveltejs/kit';

import { AuthApiError, bootstrapOwnerAccount, setAuthCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const payload = await request.json();
		const result = await bootstrapOwnerAccount(payload ?? {});
		setAuthCookie(cookies, result.token, result.expiresAt);

		return json(result, { status: 201 });
	} catch (error) {
		if (error instanceof AuthApiError) {
			return json({ error: error.message }, { status: error.status });
		}

		const message = error instanceof Error ? error.message : 'Unable to create owner account';

		return json({ error: message }, { status: 500 });
	}
};