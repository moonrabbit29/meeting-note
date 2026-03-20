import { json, type RequestHandler } from '@sveltejs/kit';

import {
	AuthApiError,
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
		if (error instanceof AuthApiError) {
			return json({ error: error.message }, { status: error.status });
		}

		const message = error instanceof Error ? error.message : 'Unable to create account';

		return json({ error: message }, { status: 500 });
	}
};