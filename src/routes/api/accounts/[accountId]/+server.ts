import { json, type RequestHandler } from '@sveltejs/kit';

import { AuthApiError, requireOwnerAccount, updateManagedAccountStatus } from '$lib/server/auth';

function toErrorResponse(error: unknown, fallbackMessage: string): Response {
	if (error instanceof AuthApiError) {
		return json({ error: error.message }, { status: error.status });
	}

	const message = error instanceof Error ? error.message : fallbackMessage;

	return json({ error: message }, { status: 500 });
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