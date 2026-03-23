import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('/calendar server load + actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads calendar events from calendar API', async () => {
		const events = [
			{
				id: 1,
				title: 'Rapat Mingguan',
				startTime: '2026-05-15T09:00:00.000Z',
				endTime: '2026-05-15T10:00:00.000Z',
				formSubmissionId: null,
				isCancelled: false,
				reportSummary: null
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

	it('createSpontaneousReport action creates both form submission and calendar event', async () => {
		const { actions } = await import('../../src/routes/calendar/+page.server');
		const formData = new FormData();
		formData.set('title', 'Spontaneous Sync');
		formData.set('startTime', '2026-05-15T14:00');
		formData.set('endTime', '2026-05-15T15:00');
		formData.set('namaPegawai', 'Dendi');
		formData.set('deskripsiMeeting', 'Diskusi mendadak');

		const request = new Request('http://localhost/calendar?/createSpontaneousReport', {
			method: 'POST',
			body: formData
		});
		const fetch = vi.fn().mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					success: true,
					calendarEventId: 9,
					formSubmissionId: 81
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);

		const result = await actions.createSpontaneousReport({
			request,
			locals: { account: { id: 7 } },
			fetch
		} as never);

		expect(fetch).toHaveBeenCalledWith('/api/calendar?action=createSpontaneousReport', {
			method: 'POST',
			body: formData
		});

		expect(result).toEqual({
			success: true,
			calendarEventId: 9,
			formSubmissionId: 81
		});
	});

	it('createPlannedEvent action creates a planned calendar entry', async () => {
		const { actions } = await import('../../src/routes/calendar/+page.server');
		const formData = new FormData();
		formData.set('title', 'Rapat Rencana');
		formData.set('startTime', '2026-05-20T09:00');
		formData.set('endTime', '2026-05-20T10:00');

		const request = new Request('http://localhost/calendar?/createPlannedEvent', {
			method: 'POST',
			body: formData
		});
		const fetch = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true, eventId: 14 }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const result = await actions.createPlannedEvent({
			request,
			locals: { account: { id: 7 } },
			fetch
		} as never);

		expect(fetch).toHaveBeenCalledWith('/api/calendar?action=createPlannedEvent', {
			method: 'POST',
			body: formData
		});
		expect(result).toEqual({ success: true, eventId: 14 });
	});

	it('updatePlannedEvent action updates title/time details', async () => {
		const { actions } = await import('../../src/routes/calendar/+page.server');
		const formData = new FormData();
		formData.set('eventId', '17');
		formData.set('title', 'Judul Baru');
		formData.set('startTime', '2026-05-20T08:00:00.000Z');
		formData.set('endTime', '2026-05-20T09:00:00.000Z');

		const request = new Request('http://localhost/calendar?/updatePlannedEvent', {
			method: 'POST',
			body: formData
		});
		const fetch = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true, eventId: 17 }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const result = await actions.updatePlannedEvent({ request, fetch } as never);

		expect(fetch).toHaveBeenCalledWith('/api/calendar?action=updatePlannedEvent', {
			method: 'POST',
			body: formData
		});
		expect(result).toEqual({ success: true, eventId: 17 });
	});

	it('cancelEvent action marks planned event as cancelled', async () => {
		const { actions } = await import('../../src/routes/calendar/+page.server');
		const formData = new FormData();
		formData.set('eventId', '17');

		const request = new Request('http://localhost/calendar?/cancelEvent', {
			method: 'POST',
			body: formData
		});
		const fetch = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true, eventId: 17 }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const result = await actions.cancelEvent({ request, fetch } as never);

		expect(fetch).toHaveBeenCalledWith('/api/calendar?action=cancelEvent', {
			method: 'POST',
			body: formData
		});
		expect(result).toEqual({ success: true, eventId: 17 });
	});
});