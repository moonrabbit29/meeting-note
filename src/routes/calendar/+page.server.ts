import type { PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

type ActionData = {
	eventId: number;
	title: string;
	startTime: string;
	endTime: string;
};

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

type CalendarLoadResponse = {
	events: unknown[];
};

type CalendarActionSuccessResponse = {
	success: true;
	calendarEventId?: number;
	formSubmissionId?: number;
	eventId?: number;
};

type CalendarActionErrorResponse = {
	error: string;
};

async function callCalendarAction(
	fetchFn: typeof fetch,
	action: 'createSpontaneousReport' | 'createPlannedEvent' | 'updatePlannedEvent' | 'cancelEvent',
	formData: FormData
): Promise<CalendarActionSuccessResponse> {
	const response = await fetchFn(`/api/calendar?action=${action}`, {
		method: 'POST',
		body: formData
	});

	const body = (await response.json()) as CalendarActionSuccessResponse | CalendarActionErrorResponse;

	if (!response.ok) {
		const message = 'error' in body ? body.error : 'Unable to process calendar action';
		throw new Error(message);
	}

	return body as CalendarActionSuccessResponse;
}

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/calendar');

		if (!response.ok) {
			throw new Error('Unable to load calendar events');
		}

		const body = (await response.json()) as CalendarLoadResponse;

		if (!Array.isArray(body.events)) {
			throw new Error('Invalid calendar response');
		}

		return {
			events: body.events,
			loadError: null
		};
	} catch {
		return {
			events: [],
			loadError: null
		};
	}
};

export const actions = {
	createPlannedEvent: async ({ request, locals, fetch }) => {
		try {
			if (!locals.account) {
				return fail(401, { error: 'Authentication required' });
			}

			const formData = await request.formData();
			const result = await callCalendarAction(fetch, 'createPlannedEvent', formData);

			return {
				success: true,
				eventId: result.eventId
			};
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Unable to create planned event'
			});
		}
	},

	createSpontaneousReport: async ({ request, locals, fetch }) => {
		try {
			if (!locals.account) {
				return fail(401, { error: 'Authentication required' });
			}

			const formData = await request.formData();
			const result = await callCalendarAction(fetch, 'createSpontaneousReport', formData);

			return {
				success: true,
				calendarEventId: result.calendarEventId,
				formSubmissionId: result.formSubmissionId
			};
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Unable to create spontaneous report'
			});
		}
	},

	updatePlannedEvent: async ({ request, fetch }) => {
		try {
			const formData = await request.formData();
			const data = parseActionData(formData);
			const result = await callCalendarAction(fetch, 'updatePlannedEvent', formData);

			return {
				success: true,
				eventId: result.eventId ?? data.eventId
			};
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Unable to update planned event'
			});
		}
	},

	cancelEvent: async ({ request, fetch }) => {
		try {
			const formData = await request.formData();
			const eventId = Number(readRequiredString(formData, 'eventId'));

			if (!Number.isInteger(eventId) || eventId <= 0) {
				throw new Error('eventId must be a positive integer');
			}

			const result = await callCalendarAction(fetch, 'cancelEvent', formData);

			return {
				success: true,
				eventId: result.eventId ?? eventId
			};
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Unable to cancel event'
			});
		}
	}
};