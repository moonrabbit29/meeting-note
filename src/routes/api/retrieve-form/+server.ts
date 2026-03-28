import { json, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import { listFormSubmissions } from '$lib/server/form-submissions';

export const GET: RequestHandler = async () => {
	try {
		const submissions = await listFormSubmissions('upload-form');

		return json({ submissions });
	} catch (error) {
		const mappedError = mapApiError(error, 'Unable to retrieve form submissions');
		logApiError('api.retrieve-form.get', error);
		return json({ error: mappedError.message }, { status: mappedError.status });
	}
};