import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCalendarEventsWithReports = vi.fn();
const findCalendarEventWithReportById = vi.fn();
const createPlannedCalendarEvent = vi.fn();
const createSpontaneousMeetingWithCalendarEvent = vi.fn();
const updatePlannedCalendarEventDetails = vi.fn();
const cancelPlannedCalendarEvent = vi.fn();

vi.mock('$lib/server/calendar-events', () => ({
	listCalendarEventsWithReports,
	findCalendarEventWithReportById,
	createPlannedCalendarEvent,
	createSpontaneousMeetingWithCalendarEvent,
	updatePlannedCalendarEventDetails,
	cancelPlannedCalendarEvent
}));

describe('/api/calendar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns calendar events from GET', async () => {
		listCalendarEventsWithReports.mockResolvedValueOnce([
			{
				id: 1,
				title: 'Rapat Mingguan',
				startTime: '2026-05-15T09:00:00.000Z',
				endTime: '2026-05-15T10:00:00.000Z',
				formSubmissionId: null,
				isCancelled: false,
				reportSummary: null
			}
		]);

		const { GET } = await import('../../src/routes/api/calendar/+server');
		const response = await GET({ request: new Request('http://localhost/api/calendar') } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			events: [
				{
					id: 1,
					title: 'Rapat Mingguan',
					startTime: '2026-05-15T09:00:00.000Z',
					endTime: '2026-05-15T10:00:00.000Z',
					formSubmissionId: null,
					isCancelled: false,
					reportSummary: null
				}
			]
		});
	});

	it('maps service failures to 500', async () => {
		listCalendarEventsWithReports.mockRejectedValueOnce(new Error('db offline'));

		const { GET } = await import('../../src/routes/api/calendar/+server');
		const response = await GET({ request: new Request('http://localhost/api/calendar') } as never);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body).toEqual({ error: 'db offline' });
	});

	it('returns a single calendar event from GET when eventId is provided', async () => {
		findCalendarEventWithReportById.mockResolvedValueOnce({
			id: 17,
			title: 'Rapat Tindak Lanjut',
			startTime: '2026-03-21T09:00:00.000Z',
			endTime: '2026-03-21T10:00:00.000Z',
			formSubmissionId: null,
			isCancelled: false,
			reportSummary: null
		});

		const { GET } = await import('../../src/routes/api/calendar/+server');
		const response = await GET({
			request: new Request('http://localhost/api/calendar?eventId=17')
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(findCalendarEventWithReportById).toHaveBeenCalledWith(17);
		expect(body).toEqual({
			event: {
				id: 17,
				title: 'Rapat Tindak Lanjut',
				startTime: '2026-03-21T09:00:00.000Z',
				endTime: '2026-03-21T10:00:00.000Z',
				formSubmissionId: null,
				isCancelled: false,
				reportSummary: null
			}
		});
	});

	it('rejects invalid eventId on GET', async () => {
		const { GET } = await import('../../src/routes/api/calendar/+server');
		const response = await GET({
			request: new Request('http://localhost/api/calendar?eventId=abc')
		} as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ error: 'eventId must be a positive integer' });
	});

	it('creates spontaneous report via POST action', async () => {
		createSpontaneousMeetingWithCalendarEvent.mockResolvedValueOnce({
			calendarEventId: 9,
			formSubmissionId: 81
		});

		const formData = new FormData();
		formData.set('title', 'Spontaneous Sync');
		formData.set('startTime', '2026-05-15T14:00');
		formData.set('endTime', '2026-05-15T15:00');
		formData.set('namaPegawai', 'Dendi');
		formData.set('deskripsiMeeting', 'Diskusi mendadak');

		const { POST } = await import('../../src/routes/api/calendar/+server');
		const request = new Request('http://localhost/api/calendar?action=createSpontaneousReport', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request, locals: { account: { id: 7 } } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(createSpontaneousMeetingWithCalendarEvent).toHaveBeenCalledWith({
			employeeId: 7,
			title: 'Spontaneous Sync',
			startTime: '2026-05-15T14:00',
			endTime: '2026-05-15T15:00',
			namaPegawai: 'Dendi',
			deskripsiMeeting: 'Diskusi mendadak'
		});
		expect(body).toEqual({
			success: true,
			calendarEventId: 9,
			formSubmissionId: 81
		});
	});

	it('creates planned event via POST action', async () => {
		createPlannedCalendarEvent.mockResolvedValueOnce({
			id: 14,
			title: 'Rapat Rencana',
			startTime: '2026-05-20T09:00:00.000Z',
			endTime: '2026-05-20T10:00:00.000Z',
			formSubmissionId: null,
			isCancelled: false,
			reportSummary: null
		});

		const formData = new FormData();
		formData.set('title', 'Rapat Rencana');
		formData.set('startTime', '2026-05-20T09:00');
		formData.set('endTime', '2026-05-20T10:00');

		const { POST } = await import('../../src/routes/api/calendar/+server');
		const request = new Request('http://localhost/api/calendar?action=createPlannedEvent', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request, locals: { account: { id: 7 } } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(createPlannedCalendarEvent).toHaveBeenCalledWith({
			title: 'Rapat Rencana',
			startTime: '2026-05-20T09:00',
			endTime: '2026-05-20T10:00'
		});
		expect(body).toEqual({ success: true, eventId: 14 });
	});

	it('rejects createPlannedEvent when unauthenticated', async () => {
		const { POST } = await import('../../src/routes/api/calendar/+server');
		const request = new Request('http://localhost/api/calendar?action=createPlannedEvent', {
			method: 'POST',
			body: new FormData()
		});

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ error: 'Authentication required' });
	});

	it('rejects createSpontaneousReport when unauthenticated', async () => {
		const { POST } = await import('../../src/routes/api/calendar/+server');
		const request = new Request('http://localhost/api/calendar?action=createSpontaneousReport', {
			method: 'POST',
			body: new FormData()
		});

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ error: 'Authentication required' });
	});

	it('updates planned event via POST action', async () => {
		updatePlannedCalendarEventDetails.mockResolvedValueOnce({
			id: 17,
			title: 'Judul Baru',
			startTime: '2026-05-20T08:00:00.000Z',
			endTime: '2026-05-20T09:00:00.000Z',
			formSubmissionId: null,
			isCancelled: false,
			reportSummary: null
		});

		const formData = new FormData();
		formData.set('eventId', '17');
		formData.set('title', 'Judul Baru');
		formData.set('startTime', '2026-05-20T08:00:00.000Z');
		formData.set('endTime', '2026-05-20T09:00:00.000Z');

		const { POST } = await import('../../src/routes/api/calendar/+server');
		const request = new Request('http://localhost/api/calendar?action=updatePlannedEvent', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(updatePlannedCalendarEventDetails).toHaveBeenCalledWith({
			eventId: 17,
			title: 'Judul Baru',
			startTime: '2026-05-20T08:00:00.000Z',
			endTime: '2026-05-20T09:00:00.000Z'
		});
		expect(body).toEqual({ success: true, eventId: 17 });
	});

	it('cancels event via POST action', async () => {
		cancelPlannedCalendarEvent.mockResolvedValueOnce({
			id: 17,
			title: 'Rapat',
			startTime: '2026-05-20T08:00:00.000Z',
			endTime: '2026-05-20T09:00:00.000Z',
			formSubmissionId: null,
			isCancelled: true,
			reportSummary: null
		});

		const formData = new FormData();
		formData.set('eventId', '17');

		const { POST } = await import('../../src/routes/api/calendar/+server');
		const request = new Request('http://localhost/api/calendar?action=cancelEvent', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(cancelPlannedCalendarEvent).toHaveBeenCalledWith(17);
		expect(body).toEqual({ success: true, eventId: 17 });
	});

	it('returns 400 for unsupported action', async () => {
		const { POST } = await import('../../src/routes/api/calendar/+server');
		const request = new Request('http://localhost/api/calendar?action=unknownAction', {
			method: 'POST',
			body: new FormData()
		});

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ error: 'Unsupported action' });
	});
});
