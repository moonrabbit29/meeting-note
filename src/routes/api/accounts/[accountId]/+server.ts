import { json, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import { requireOwnerAccount, updateManagedAccountStatus } from '$lib/server/auth';

function toErrorResponse(error: unknown, fallbackMessage: string): Response {
	const mappedError = mapApiError(error, fallbackMessage);
	logApiError('api.accounts.patch', error);
	return json({ error: mappedError.message }, { status: mappedError.status });
}

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const owner = await requireOwnerAccount(request);
		const payload = await request.json();
		const account = await updateManagedAccountStatus(
			Number(params.accountId),
			payload?.isActive,
			owner
		);

		return json({ account });
	} catch (error) {
		return toErrorResponse(error, 'Unable to update account status');
	}
};