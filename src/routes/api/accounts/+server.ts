import { json, type RequestHandler } from '@sveltejs/kit';

import { AuthApiError, listManagedAccounts, requireOwnerAccount } from '$lib/server/auth';

function toErrorResponse(error: unknown, fallbackMessage: string): Response {
	if (error instanceof AuthApiError) {
		return json({ error: error.message }, { status: error.status });
	}

	const message = error instanceof Error ? error.message : fallbackMessage;

	return json({ error: message }, { status: 500 });
}

export const GET: RequestHandler = async ({ request }) => {
	try {
		const owner = await requireOwnerAccount(request);
		const accounts = await listManagedAccounts(owner);

		return json({ accounts });
	} catch (error) {
		return toErrorResponse(error, 'Unable to retrieve accounts');
	}
};