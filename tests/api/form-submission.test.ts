import { beforeEach, describe, expect, it, vi } from 'vitest';

const backfillMeetingPdfReports = vi.fn();
const createMeetingFormSubmission = vi.fn();
const listMeetingFormSubmissions = vi.fn();
const regenerateMeetingPdfReport = vi.fn();

vi.mock('$lib/server/meeting-form-submissions', () => ({
	backfillMeetingPdfReports,
	createMeetingFormSubmission,
	listMeetingFormSubmissions,
	regenerateMeetingPdfReport
}));

describe('/api/form-submission', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns submissions from GET', async () => {
		listMeetingFormSubmissions.mockResolvedValueOnce([
			{
				id: 1,
				submissionType: 'meeting',
				fields: { namaPegawai: 'Dendi' },
				files: [],
				pdfLink: null,
				submittedAt: '2026-03-15 10:00:00'
			}
		]);

		const { GET } = await import('../../src/routes/api/form-submission/+server');
		const response = await GET({ request: new Request('http://localhost/api/form-submission') } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			submissions: [
				{
					id: 1,
					submissionType: 'meeting',
					fields: { namaPegawai: 'Dendi' },
					files: [],
					pdfLink: null,
					submittedAt: '2026-03-15 10:00:00'
				}
			]
		});
	});

	it('starts background PDF backfill when requested', async () => {
		backfillMeetingPdfReports.mockResolvedValueOnce(3);

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission?action=backfill-pdf', {
			method: 'POST'
		});

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(202);
		expect(backfillMeetingPdfReports).toHaveBeenCalledTimes(1);
		expect(body.message).toContain('Background PDF generation started');
	});

	it('regenerates PDF for a specific submission', async () => {
		regenerateMeetingPdfReport.mockResolvedValueOnce('/generated-pdfs/meeting-reports/meeting-report-2.pdf');

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request(
			'http://localhost/api/form-submission?action=regenerate-pdf&submissionId=2',
			{
				method: 'POST'
			}
		);

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(regenerateMeetingPdfReport).toHaveBeenCalledTimes(1);
		expect(regenerateMeetingPdfReport).toHaveBeenCalledWith(2);
		expect(body).toEqual({
			message: 'PDF regenerated successfully',
			pdfLink: '/generated-pdfs/meeting-reports/meeting-report-2.pdf'
		});
	});

	it('rejects regenerate-pdf when submissionId is invalid', async () => {
		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request(
			'http://localhost/api/form-submission?action=regenerate-pdf&submissionId=abc',
			{
				method: 'POST'
			}
		);

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ error: 'submissionId must be a positive integer' });
		expect(regenerateMeetingPdfReport).not.toHaveBeenCalled();
	});

	it('maps regenerate-pdf not found errors to 404', async () => {
		regenerateMeetingPdfReport.mockRejectedValueOnce(new Error('Meeting submission not found'));

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request(
			'http://localhost/api/form-submission?action=regenerate-pdf&submissionId=77',
			{
				method: 'POST'
			}
		);

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toEqual({ error: 'Meeting submission not found' });
	});

	it('rejects unsupported content types on POST', async () => {
		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({})
		});

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(415);
		expect(body.error).toContain('Expected multipart/form-data');
	});

	it('creates a meeting submission on POST', async () => {
		createMeetingFormSubmission.mockResolvedValueOnce({
			id: 2,
			submissionType: 'meeting',
			fields: { namaPegawai: 'Dendi', judulMeeting: 'Rapat Mingguan' },
			files: [],
			pdfLink: null,
			submittedAt: '2026-03-15 11:00:00'
		});

		const formData = new FormData();
		formData.append('namaPegawai', 'Dendi');
		formData.append('nomorPegawaian', '12345');
		formData.append('tanggalMeeting', '2026-03-15');
		formData.append('judulMeeting', 'Rapat Mingguan');
		formData.append('melaksanakanMeeting', 'Tidak');
		formData.append('alasanTidakMeeting', 'lupa');

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			body: formData
		});

		const response = await POST({
			request,
			locals: {
				account: { id: 7 }
			}
		} as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(createMeetingFormSubmission).toHaveBeenCalledTimes(1);
		expect(createMeetingFormSubmission).toHaveBeenCalledWith(expect.any(FormData), 7, undefined);
		expect(body.submission.id).toBe(2);
	});

	it('passes eventId to the meeting submission service when provided', async () => {
		createMeetingFormSubmission.mockResolvedValueOnce({
			id: 5,
			submissionType: 'meeting',
			fields: { namaPegawai: 'Dendi', judulMeeting: 'Rapat Planned' },
			files: [],
			pdfLink: null,
			submittedAt: '2026-03-15 11:00:00'
		});

		const formData = new FormData();
		formData.append('namaPegawai', 'Dendi');
		formData.append('tanggalMeeting', '2026-03-15');
		formData.append('judulMeeting', 'Rapat Planned');
		formData.append('melaksanakanMeeting', 'Tidak');
		formData.append('alasanTidakMeeting', 'lupa');
		formData.append('eventId', '17');

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			body: formData
		});

		const response = await POST({
			request,
			locals: {
				account: { id: 7 }
			}
		} as never);

		expect(response.status).toBe(201);
		expect(createMeetingFormSubmission).toHaveBeenCalledWith(expect.any(FormData), 7, 17);
	});

	it('preserves inline font and alignment styles from rich text HTML on POST', async () => {
		createMeetingFormSubmission.mockResolvedValueOnce({
			id: 3,
			submissionType: 'meeting',
			fields: { namaPegawai: 'Dendi', judulMeeting: 'Rapat Styled' },
			files: [],
			pdfLink: null,
			submittedAt: '2026-03-20 10:00:00'
		});

		const styledHtml =
			'<p style="font-family: Arial; text-align: right;">Ringkasan</p><p style="font-family: Verdana; text-align: center;">Poin kedua</p>';

		const formData = new FormData();
		formData.append('namaPegawai', 'Dendi');
		formData.append('tanggalMeeting', '2026-03-20');
		formData.append('judulMeeting', 'Rapat Styled');
		formData.append('melaksanakanMeeting', 'Ya');
		formData.append('deskripsiMeeting', styledHtml);
		formData.append('fotoMeeting', new File(['img'], 'meeting.jpg', { type: 'image/jpeg' }));

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			body: formData
		});

		const response = await POST({
			request,
			locals: {
				account: { id: 5 }
			}
		} as never);

		expect(response.status).toBe(201);
		expect(createMeetingFormSubmission).toHaveBeenCalledTimes(1);

		const [submittedFormData, submittedEmployeeId, submittedEventId] = createMeetingFormSubmission.mock.calls[0] as [
			FormData,
			number,
			number | undefined
		];

		expect(submittedEmployeeId).toBe(5);
		expect(submittedEventId).toBeUndefined();
		expect(submittedFormData.get('deskripsiMeeting')).toBe(styledHtml);
	});

	it('rejects invalid eventId on POST', async () => {
		const formData = new FormData();
		formData.append('namaPegawai', 'Dendi');
		formData.append('eventId', 'abc');

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request, locals: { account: { id: 1 } } } as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ error: 'eventId must be a positive integer' });
		expect(createMeetingFormSubmission).not.toHaveBeenCalled();
	});

	it('rejects unauthenticated POST requests', async () => {
		const formData = new FormData();
		formData.append('namaPegawai', 'Dendi');

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request, locals: { account: null } } as never);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ error: 'Authentication required' });
		expect(createMeetingFormSubmission).not.toHaveBeenCalled();
	});

	it('maps validation errors to 400 on POST', async () => {
		createMeetingFormSubmission.mockRejectedValueOnce(new Error('Nama pegawai wajib diisi'));

		const formData = new FormData();
		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request, locals: { account: { id: 1 } } } as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ error: 'Nama pegawai wajib diisi' });
	});

	it('does not expose internal DB errors on POST', async () => {
		createMeetingFormSubmission.mockRejectedValueOnce(
			new Error('Failed query: insert into "calendar_events" ...')
		);

		const formData = new FormData();
		formData.append('namaPegawai', 'Dendi');
		formData.append('tanggalMeeting', '2026-03-15');
		formData.append('judulMeeting', 'Rapat Mingguan');
		formData.append('melaksanakanMeeting', 'Tidak');
		formData.append('alasanTidakMeeting', 'lupa');

		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request, locals: { account: { id: 1 } } } as never);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body).toEqual({ error: 'Unable to store meeting submission' });
	});
});