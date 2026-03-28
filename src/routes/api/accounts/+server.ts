import { json, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import { listManagedAccounts, requireOwnerAccount } from '$lib/server/auth';

function toErrorResponse(error: unknown, fallbackMessage: string): Response {
	const mappedError = mapApiError(error, fallbackMessage);
	logApiError('api.accounts.get', error);
	return json({ error: mappedError.message }, { status: mappedError.status });
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