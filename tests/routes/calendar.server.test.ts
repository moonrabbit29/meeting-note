import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSpontaneousMeetingWithCalendarEvent = vi.fn();
const updatePlannedCalendarEventDetails = vi.fn();
const cancelPlannedCalendarEvent = vi.fn();

vi.mock('$lib/server/calendar-events', () => ({
	createSpontaneousMeetingWithCalendarEvent,
	updatePlannedCalendarEventDetails,
	cancelPlannedCalendarEvent
}));

describe('/calendar server load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns mapped meeting events from the server', async () => {
		const events = [
			{
				id: 21,
				title: 'Rapat Bulanan',
				startTime: '2026-05-12T09:00:00.000Z',
				endTime: '2026-05-12T10:00:00.000Z',
				formSubmissionId: 21,
				isCancelled: false,
				reportSummary: {
					id: 21,
					submittedAt: '2026-05-12 10:05:00',
					fields: { namaPegawai: 'Nina' },
					pdfLink: null
				}
			}
		];
		const fetch = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ events }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const { load } = await import('../../src/routes/calendar/+page.server');
		const result = await load({ fetch } as never);

		expect(fetch).toHaveBeenCalledWith('/api/calendar');

		expect(result).toEqual({
			events,
			loadError: null
		});
	});

	it('returns an empty list and keeps loadError null when server loading fails', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ error: 'db offline' }), {
				status: 500,
				headers: { 'content-type': 'application/json' }
			})
		);

		const { load } = await import('../../src/routes/calendar/+page.server');
		const result = await load({ fetch } as never);

		expect(fetch).toHaveBeenCalledWith('/api/calendar');
		expect(result).toEqual({
			events: [],
			loadError: null
		});
	});
});