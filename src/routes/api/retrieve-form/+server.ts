import { json, type RequestHandler } from '@sveltejs/kit';

import { listFormSubmissions } from '$lib/server/form-submissions';

export const GET: RequestHandler = async () => {
	const submissions = await listFormSubmissions('upload-form');

	return json({ submissions });
};