import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import {
	backfillMeetingPdfReports,
	createMeetingFormSubmission,
	listMeetingFormSubmissions,
	regenerateMeetingPdfReport
} from '$lib/server/meeting-form-submissions';

export const GET: RequestHandler = async () => {
	try {
		const submissions = await listMeetingFormSubmissions();

		return json({ submissions });
	} catch (error) {
		const mappedError = mapApiError(error, 'Unable to load meeting submissions');
		logApiError('api.form-submission.get', error);
		return json({ error: mappedError.message }, { status: mappedError.status });
	}
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
			const mappedError = mapApiError(error, 'Unable to regenerate PDF', [
				{
					status: 404,
					clientMessage: 'Meeting submission not found',
					test: (message) => message.toLowerCase().includes('not found')
				}
			]);

			logApiError('api.form-submission.regenerate-pdf', error, {
				submissionId,
				status: mappedError.status
			});
			return json({ error: mappedError.message }, { status: mappedError.status });
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
		const mappedError = mapApiError(error, 'Unable to store meeting submission', [
			{
				status: 400,
				clientMessage: 'Invalid meeting submission data',
				test: (message) =>
					message.includes('wajib') || message.includes('Hanya file gambar')
			}
		]);

		logApiError('api.form-submission.post', error, {
			eventId,
			actorId: locals.account?.id,
			status: mappedError.status
		});
		return json({ error: mappedError.message }, { status: mappedError.status });
	}
};