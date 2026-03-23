import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';

import {
	backfillMeetingPdfReports,
	createMeetingFormSubmission,
	listMeetingFormSubmissions,
	regenerateMeetingPdfReport
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

	if (action === 'regenerate-pdf') {
		const submissionIdRaw = new URL(request.url).searchParams.get('submissionId');
		const submissionId = Number(submissionIdRaw);

		if (!Number.isInteger(submissionId) || submissionId <= 0) {
			return json({ error: 'submissionId must be a positive integer' }, { status: 400 });
		}

		try {
			const pdfLink = await regenerateMeetingPdfReport(submissionId);

			return json({ message: 'PDF regenerated successfully', pdfLink });
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unable to regenerate PDF';
			const status = message.includes('not found') ? 404 : 500;
			const clientMessage = status === 500 ? 'Unable to regenerate PDF' : message;

			return json({ error: clientMessage }, { status });
		}
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
		const eventIdRaw = formData.get('eventId');
		const eventId =
			typeof eventIdRaw === 'string' && eventIdRaw.trim().length > 0
				? Number(eventIdRaw)
				: undefined;

		if (eventId !== undefined && (!Number.isInteger(eventId) || eventId <= 0)) {
			return json({ error: 'eventId must be a positive integer' }, { status: 400 });
		}

		const submission = await createMeetingFormSubmission(formData, locals.account.id, eventId);

		return json({ submission }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to store meeting submission';
		const status =
			message.includes('wajib') || message.includes('Hanya file gambar') ? 400 : 500;
		const clientMessage = status === 500 ? 'Unable to store meeting submission' : message;

		return json({ error: clientMessage }, { status });
	}
};