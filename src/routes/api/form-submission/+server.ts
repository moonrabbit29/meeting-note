import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';

import {
	backfillMeetingPdfReports,
	createMeetingFormSubmission,
	listMeetingFormSubmissions
} from '$lib/server/meeting-form-submissions';

export const GET: RequestHandler = async () => {
	const submissions = await listMeetingFormSubmissions();

	return json({ submissions });
};

export const POST: RequestHandler = async ({ request, locals }: RequestEvent) => {
	const action = new URL(request.url).searchParams.get('action');

	if (action === 'backfill-pdf') {
		void backfillMeetingPdfReports();

		return json(
			{ message: 'Background PDF generation started for submissions without PDF links.' },
			{ status: 202 }
		);
	}

	const contentType = request.headers.get('content-type') ?? '';
	const acceptsFormData =
		contentType.includes('multipart/form-data') ||
		contentType.includes('application/x-www-form-urlencoded');

	if (!acceptsFormData) {
		return json(
			{ error: 'Expected multipart/form-data or application/x-www-form-urlencoded payload' },
			{ status: 415 }
		);
	}

	try {
		if (!locals.account) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const formData = await request.formData();
		const submission = await createMeetingFormSubmission(formData, locals.account.id);

		return json({ submission }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to store meeting submission';
		const status =
			message.includes('wajib') || message.includes('Hanya file gambar') ? 400 : 500;

		return json({ error: message }, { status });
	}
};