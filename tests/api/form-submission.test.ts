import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMeetingFormSubmission = vi.fn();
const listMeetingFormSubmissions = vi.fn();

vi.mock('$lib/server/meeting-form-submissions', () => ({
	createMeetingFormSubmission,
	listMeetingFormSubmissions
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
				submittedAt: '2026-03-15 10:00:00'
			}
		]);

		const { GET } = await import('../../src/routes/api/form-submission/+server');
		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			submissions: [
				{
					id: 1,
					submissionType: 'meeting',
					fields: { namaPegawai: 'Dendi' },
					files: [],
					submittedAt: '2026-03-15 10:00:00'
				}
			]
		});
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

		const response = await POST({ request } as never);
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

		const response = await POST({ request } as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(createMeetingFormSubmission).toHaveBeenCalledTimes(1);
		expect(body.submission.id).toBe(2);
	});

	it('maps validation errors to 400 on POST', async () => {
		createMeetingFormSubmission.mockRejectedValueOnce(new Error('Nama pegawai wajib diisi'));

		const formData = new FormData();
		const { POST } = await import('../../src/routes/api/form-submission/+server');
		const request = new Request('http://localhost/api/form-submission', {
			method: 'POST',
			body: formData
		});

		const response = await POST({ request } as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ error: 'Nama pegawai wajib diisi' });
	});
});