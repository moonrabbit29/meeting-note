import { json, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import {
	createManagedAccount,
	requireSystemAdministratorAccount
} from '$lib/server/auth';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const actor = await requireSystemAdministratorAccount(request);
		const payload = await request.json();
		const account = await createManagedAccount(payload ?? {}, actor);

		return json({ account }, { status: 201 });
	} catch (error) {
		const mappedError = mapApiError(error, 'Unable to create account');
		logApiError('api.signup.post', error);
		return json({ error: mappedError.message }, { status: mappedError.status });
	}
};