import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMeetingFormSubmissions = vi.fn();

vi.mock('$lib/server/meeting-form-submissions', () => ({
	listMeetingFormSubmissions
}));

describe('meeting-note calendar mapping', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('maps meeting submissions into FullCalendar events ordered by meeting date', async () => {
		listMeetingFormSubmissions.mockResolvedValueOnce([
			{
				id: 12,
				employeeId: 7,
				submissionType: 'meeting',
				pdfLink: null,
				fields: {
					namaPegawai: 'Budi',
					judulMeeting: 'Forum Data',
					tanggalMeeting: '2026-04-23',
					melaksanakanMeeting: 'Tidak',
					deskripsiMeeting: 'Agenda dibatalkan'
				},
				files: [],
				submittedAt: '2026-04-25 09:00:00'
			},
			{
				id: 9,
				employeeId: 4,
				submissionType: 'meeting',
				pdfLink: '/generated-pdfs/meeting-reports/meeting-report-9.pdf',
				fields: {
					namaPegawai: 'Dendi',
					judulMeeting: 'Rapat Koordinasi',
					tanggalMeeting: '2026-04-18',
					melaksanakanMeeting: 'Ya',
					deskripsiMeeting: '<p>Sinkronisasi agenda lintas bidang</p>'
				},
				files: [],
				submittedAt: '2026-04-18 08:00:00'
			}
		]);

		const { listMeetingNoteCalendarEvents } = await import(
			'../../../src/lib/server/meeting-note-calendar'
		);
		const events = await listMeetingNoteCalendarEvents();

		expect(listMeetingFormSubmissions).toHaveBeenCalledTimes(1);
		expect(events).toHaveLength(2);
		expect(events[0]).toMatchObject({
			id: '9',
			title: 'Rapat Koordinasi',
			start: '2026-04-18',
			backgroundColor: '#0f766e',
			extendedProps: {
				employeeName: 'Dendi',
				executionStatus: 'Ya',
				description: 'Sinkronisasi agenda lintas bidang',
				pdfLink: '/generated-pdfs/meeting-reports/meeting-report-9.pdf'
			}
		});
		expect(events[1]).toMatchObject({
			id: '12',
			title: 'Forum Data',
			start: '2026-04-23',
			backgroundColor: '#b45309',
			extendedProps: {
				employeeName: 'Budi',
				executionStatus: 'Tidak',
				description: 'Agenda dibatalkan'
			}
		});
	});

	it('falls back to submittedAt when tanggalMeeting is missing', async () => {
		listMeetingFormSubmissions.mockResolvedValueOnce([
			{
				id: 18,
				employeeId: 8,
				submissionType: 'meeting',
				pdfLink: null,
				fields: {
					namaPegawai: ['Alya'],
					judulMeeting: ['Review Triwulan'],
					melaksanakanMeeting: 'Ya'
				},
				files: [],
				submittedAt: '2026-05-04 07:30:00'
			}
		]);

		const { listMeetingNoteCalendarEvents } = await import(
			'../../../src/lib/server/meeting-note-calendar'
		);
		const events = await listMeetingNoteCalendarEvents();

		expect(events).toEqual([
			expect.objectContaining({
				id: '18',
				title: 'Review Triwulan',
				start: '2026-05-04',
				extendedProps: expect.objectContaining({
					employeeName: 'Alya',
					executionStatus: 'Ya'
				})
			})
		]);
	});
});