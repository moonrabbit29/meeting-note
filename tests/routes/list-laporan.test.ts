import { describe, expect, it, vi } from 'vitest';

describe('/list-laporan load', () => {
	it('returns submissions from the API response', async () => {
		const { load } = await import('../../src/routes/list-laporan/+page');
		const fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				submissions: [
					{
						id: 11,
						submissionType: 'meeting',
						fields: { judulMeeting: 'Rapat Koordinasi' },
						files: [],
						pdfLink: '/generated-pdfs/meeting-reports/meeting-report-11.pdf',
						submittedAt: '2026-03-16 09:00:00'
					}
				]
			})
		});

		const result = await load({ fetch } as never);

		expect(fetch).toHaveBeenCalledWith('/api/form-submission');
		expect(result).toEqual({
			submissions: [
				{
					id: 11,
					submissionType: 'meeting',
					fields: { judulMeeting: 'Rapat Koordinasi' },
					files: [],
					pdfLink: '/generated-pdfs/meeting-reports/meeting-report-11.pdf',
					submittedAt: '2026-03-16 09:00:00'
				}
			],
			loadError: null
		});
	});

	it('returns an empty list and error message when the API fails', async () => {
		const { load } = await import('../../src/routes/list-laporan/+page');
		const fetch = vi.fn().mockResolvedValue({
			ok: false
		});

		const result = await load({ fetch } as never);

		expect(result).toEqual({
			submissions: [],
			loadError: 'Gagal memuat daftar laporan meeting.'
		});
	});
});