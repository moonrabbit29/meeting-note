import { json, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import { bootstrapOwnerAccount, setAuthCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const payload = await request.json();
		const result = await bootstrapOwnerAccount(payload ?? {});
		setAuthCookie(cookies, result.token, result.expiresAt);

		return json(result, { status: 201 });
	} catch (error) {
		const mappedError = mapApiError(error, 'Unable to create owner account');
		logApiError('api.accounts.owner.post', error);
		return json({ error: mappedError.message }, { status: mappedError.status });
	}
};