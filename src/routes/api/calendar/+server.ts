import { json, type RequestHandler } from '@sveltejs/kit';

import { logApiError, mapApiError } from '$lib/server/api-errors';
import {
	cancelPlannedCalendarEvent,
	createPlannedCalendarEvent,
	createSpontaneousMeetingWithCalendarEvent,
	findCalendarEventWithReportById,
	listCalendarEventsWithReports,
	updatePlannedCalendarEventDetails
} from '$lib/server/calendar-events';

type ActionData = {
	eventId: number;
	title: string;
	startTime: string;
	endTime: string;
};

const calendarApiDebugEnabled = () => process.env.DEBUG_CALENDAR_API === '1';
let calendarApiRequestSeq = 0;

function nextRequestId(): string {
	calendarApiRequestSeq += 1;
	return `cal-${calendarApiRequestSeq}`;
}

function safeErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown error';
}

function debugCalendarApi(
	requestId: string,
	stage: string,
	meta: Record<string, string | number | boolean>
): void {
	if (!calendarApiDebugEnabled()) {
		return;
	}

	// Keep log payload tiny: only flat primitive metadata, never full form/request bodies.
	console.info('[calendar-api]', { requestId, stage, ...meta });
}

function readRequiredString(formData: FormData, key: string): string {
	const value = formData.get(key);

	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${key} is required`);
	}

	return value.trim();
}

function parseActionData(formData: FormData): ActionData {
	const eventId = Number(readRequiredString(formData, 'eventId'));

	if (!Number.isInteger(eventId) || eventId <= 0) {
		throw new Error('eventId must be a positive integer');
	}

	return {
		eventId,
		title: readRequiredString(formData, 'title'),
		startTime: readRequiredString(formData, 'startTime'),
		endTime: readRequiredString(formData, 'endTime')
	};
}

function toApiError(error: unknown): { status: number; message: string } {
	return mapApiError(error, 'Unable to process calendar request', [
		{
			status: 404,
			clientMessage: 'Calendar event not found',
			test: (message) => message.toLowerCase().includes('not found')
		},
		{
			status: 400,
			clientMessage: 'Invalid calendar request payload',
			test: (message) =>
				message.includes('required') ||
				message.includes('must be') ||
				message.includes('Only planned')
		}
	]);
}

export const GET: RequestHandler = async ({ request }) => {
	const requestId = nextRequestId();
	const startAt = Date.now();
	debugCalendarApi(requestId, 'get.start', {});

	try {
		const eventIdParam = new URL(request.url).searchParams.get('eventId');

		if (eventIdParam !== null) {
			const eventId = Number(eventIdParam);

			if (!Number.isInteger(eventId) || eventId <= 0) {
				return json({ error: 'eventId must be a positive integer' }, { status: 400 });
			}

			const event = await findCalendarEventWithReportById(eventId);

			if (!event) {
				return json({ error: 'Calendar event not found' }, { status: 404 });
			}

			debugCalendarApi(requestId, 'get.success', {
				eventId,
				durationMs: Date.now() - startAt
			});

			return json({ event });
		}

		const events = await listCalendarEventsWithReports();
		debugCalendarApi(requestId, 'get.success', {
			eventCount: events.length,
			durationMs: Date.now() - startAt
		});

		return json({ events });
	} catch (error) {
		const mappedError = mapApiError(error, 'Unable to load calendar events');
		debugCalendarApi(requestId, 'get.error', {
			durationMs: Date.now() - startAt,
			error: safeErrorMessage(error)
		});
		logApiError('api.calendar.get', error, {
			requestId,
			status: mappedError.status,
			durationMs: Date.now() - startAt
		});

		return json({ error: mappedError.message }, { status: mappedError.status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestId = nextRequestId();
	const startAt = Date.now();
	const action = new URL(request.url).searchParams.get('action');
	debugCalendarApi(requestId, 'post.start', { action: action ?? 'null' });

	if (action === 'createSpontaneousReport') {
		try {
			if (!locals.account) {
				debugCalendarApi(requestId, 'post.unauthorized', {
					action,
					durationMs: Date.now() - startAt
				});
				return json({ error: 'Authentication required' }, { status: 401 });
			}

			const formData = await request.formData();
			debugCalendarApi(requestId, 'post.payload', {
				action,
				hasTitle: typeof formData.get('title') === 'string',
				hasStartTime: typeof formData.get('startTime') === 'string',
				hasEndTime: typeof formData.get('endTime') === 'string'
			});
			const result = await createSpontaneousMeetingWithCalendarEvent({
				employeeId: locals.account.id,
				title: readRequiredString(formData, 'title'),
				startTime: readRequiredString(formData, 'startTime'),
				endTime: readRequiredString(formData, 'endTime'),
				namaPegawai: readRequiredString(formData, 'namaPegawai'),
				deskripsiMeeting: readRequiredString(formData, 'deskripsiMeeting')
			});
			debugCalendarApi(requestId, 'post.success', {
				action,
				eventId: result.calendarEventId,
				submissionId: result.formSubmissionId,
				durationMs: Date.now() - startAt
			});

			return json({
				success: true,
				calendarEventId: result.calendarEventId,
				formSubmissionId: result.formSubmissionId
			});
		} catch (error) {
			const apiError = toApiError(error);
			debugCalendarApi(requestId, 'post.error', {
				action,
				status: apiError.status,
				durationMs: Date.now() - startAt,
				error: safeErrorMessage(error)
			});
			logApiError('api.calendar.post.createSpontaneousReport', error, {
				requestId,
				status: apiError.status,
				action,
				durationMs: Date.now() - startAt
			});

			return json({ error: apiError.message }, { status: apiError.status });
		}
	}

	if (action === 'createPlannedEvent') {
		try {
			if (!locals.account) {
				debugCalendarApi(requestId, 'post.unauthorized', {
					action,
					durationMs: Date.now() - startAt
				});
				return json({ error: 'Authentication required' }, { status: 401 });
			}

			const formData = await request.formData();
			const result = await createPlannedCalendarEvent({
				title: readRequiredString(formData, 'title'),
				startTime: readRequiredString(formData, 'startTime'),
				endTime: readRequiredString(formData, 'endTime')
			});

			debugCalendarApi(requestId, 'post.success', {
				action,
				eventId: result.id,
				durationMs: Date.now() - startAt
			});

			return json({ success: true, eventId: result.id });
		} catch (error) {
			const apiError = toApiError(error);
			debugCalendarApi(requestId, 'post.error', {
				action,
				status: apiError.status,
				durationMs: Date.now() - startAt,
				error: safeErrorMessage(error)
			});
			logApiError('api.calendar.post.createPlannedEvent', error, {
				requestId,
				status: apiError.status,
				action,
				durationMs: Date.now() - startAt
			});

			return json({ error: apiError.message }, { status: apiError.status });
		}
	}

	if (action === 'updatePlannedEvent') {
		try {
			const formData = await request.formData();
			const data = parseActionData(formData);

			await updatePlannedCalendarEventDetails(data);
			debugCalendarApi(requestId, 'post.success', {
				action,
				eventId: data.eventId,
				durationMs: Date.now() - startAt
			});

			return json({ success: true, eventId: data.eventId });
		} catch (error) {
			const apiError = toApiError(error);
			debugCalendarApi(requestId, 'post.error', {
				action,
				status: apiError.status,
				durationMs: Date.now() - startAt,
				error: safeErrorMessage(error)
			});
			logApiError('api.calendar.post.updatePlannedEvent', error, {
				requestId,
				status: apiError.status,
				action,
				durationMs: Date.now() - startAt
			});

			return json({ error: apiError.message }, { status: apiError.status });
		}
	}

	if (action === 'cancelEvent') {
		try {
			const formData = await request.formData();
			const eventId = Number(readRequiredString(formData, 'eventId'));

			if (!Number.isInteger(eventId) || eventId <= 0) {
				throw new Error('eventId must be a positive integer');
			}

			const cancelReason = formData.get('cancelReason');
			await cancelPlannedCalendarEvent(eventId, typeof cancelReason === 'string' ? cancelReason : undefined);
			debugCalendarApi(requestId, 'post.success', {
				action,
				eventId,
				durationMs: Date.now() - startAt
			});

			return json({ success: true, eventId });
		} catch (error) {
			const apiError = toApiError(error);
			debugCalendarApi(requestId, 'post.error', {
				action,
				status: apiError.status,
				durationMs: Date.now() - startAt,
				error: safeErrorMessage(error)
			});
			logApiError('api.calendar.post.cancelEvent', error, {
				requestId,
				status: apiError.status,
				action,
				durationMs: Date.now() - startAt
			});

			return json({ error: apiError.message }, { status: apiError.status });
		}
	}

	debugCalendarApi(requestId, 'post.unsupported_action', {
		action: action ?? 'null',
		durationMs: Date.now() - startAt
	});

	return json({ error: 'Unsupported action' }, { status: 400 });
};