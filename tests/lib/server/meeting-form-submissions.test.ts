import { beforeEach, describe, expect, it, vi } from 'vitest';

const createFormSubmission = vi.fn();
const findFormSubmissionById = vi.fn();
const listFormSubmissions = vi.fn();
const findCalendarEventRowById = vi.fn();
const insertCalendarEventRow = vi.fn();
const updateCalendarEventRow = vi.fn();
const queueMeetingReportPdfGeneration = vi.fn();
const queueMissingMeetingReportPdfGeneration = vi.fn();
const generateMeetingReportPdf = vi.fn();

vi.mock('$lib/server/form-submissions', () => ({
	createFormSubmission,
	findFormSubmissionById,
	listFormSubmissions
}));

vi.mock('$lib/server/repositories/calendar-events', () => ({
	findCalendarEventRowById,
	insertCalendarEventRow
	,
	updateCalendarEventRow
}));

vi.mock('$lib/server/pdf/meetingReportPdf', () => ({
	generateMeetingReportPdf,
	queueMeetingReportPdfGeneration,
	queueMissingMeetingReportPdfGeneration
}));

describe('createMeetingFormSubmission', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates a linked calendar_events row after meeting submission is stored', async () => {
		createFormSubmission.mockResolvedValueOnce({
			id: 12,
			employeeId: 7,
			submissionType: 'meeting',
			pdfLink: null,
			fields: {
				namaPegawai: 'Dendi',
				tanggalMeeting: '2026-05-15',
				judulMeeting: 'Rapat Mingguan',
				melaksanakanMeeting: 'Tidak',
				alasanTidakMeeting: 'lupa'
			},
			files: [],
			submittedAt: '2026-05-15 11:00:00'
		});

		const formData = new FormData();
		formData.set('namaPegawai', 'Dendi');
		formData.set('tanggalMeeting', '2026-05-15');
		formData.set('judulMeeting', 'Rapat Mingguan');
		formData.set('melaksanakanMeeting', 'Tidak');
		formData.set('alasanTidakMeeting', 'lupa');

		const { createMeetingFormSubmission } = await import(
			'../../../src/lib/server/meeting-form-submissions'
		);
		await createMeetingFormSubmission(formData, 7);

		expect(insertCalendarEventRow).toHaveBeenCalledTimes(1);
		expect(insertCalendarEventRow).toHaveBeenCalledWith({
			title: 'Rapat Mingguan',
			startTime: '2026-05-15T09:00:00.000Z',
			endTime: '2026-05-15T10:00:00.000Z',
			formSubmissionId: 12,
			isCancelled: false
		});
		expect(queueMeetingReportPdfGeneration).toHaveBeenCalledTimes(1);
	});

	it('falls back to submittedAt and generated title when fields are missing', async () => {
		createFormSubmission.mockResolvedValueOnce({
			id: 18,
			employeeId: 8,
			submissionType: 'meeting',
			pdfLink: null,
			fields: {
				namaPegawai: 'Alya',
				melaksanakanMeeting: 'Tidak',
				alasanTidakMeeting: 'lupa'
			},
			files: [],
			submittedAt: '2026-05-20 07:30:00'
		});

		const formData = new FormData();
		formData.set('namaPegawai', 'Alya');
		formData.set('tanggalMeeting', '2026-05-20');
		formData.set('judulMeeting', 'Fallback check');
		formData.set('melaksanakanMeeting', 'Tidak');
		formData.set('alasanTidakMeeting', 'lupa');

		const { createMeetingFormSubmission } = await import(
			'../../../src/lib/server/meeting-form-submissions'
		);
		await createMeetingFormSubmission(formData, 8);

		expect(insertCalendarEventRow).toHaveBeenCalledTimes(1);
		expect(insertCalendarEventRow).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Meeting Report #18',
				formSubmissionId: 18,
				isCancelled: false
			})
		);
	});

	it('ignores duplicate linked calendar event errors', async () => {
		createFormSubmission.mockResolvedValueOnce({
			id: 22,
			employeeId: 8,
			submissionType: 'meeting',
			pdfLink: null,
			fields: {
				namaPegawai: 'Alya',
				tanggalMeeting: '2026-05-20',
				judulMeeting: 'Rapat Duplikat',
				melaksanakanMeeting: 'Tidak',
				alasanTidakMeeting: 'lupa'
			},
			files: [],
			submittedAt: '2026-05-20 07:30:00'
		});
		insertCalendarEventRow.mockRejectedValueOnce(
			new Error('UNIQUE constraint failed: calendar_events.form_submission_id')
		);

		const formData = new FormData();
		formData.set('namaPegawai', 'Alya');
		formData.set('tanggalMeeting', '2026-05-20');
		formData.set('judulMeeting', 'Rapat Duplikat');
		formData.set('melaksanakanMeeting', 'Tidak');
		formData.set('alasanTidakMeeting', 'lupa');

		const { createMeetingFormSubmission } = await import(
			'../../../src/lib/server/meeting-form-submissions'
		);

		await expect(createMeetingFormSubmission(formData, 8)).resolves.toMatchObject({ id: 22 });
		expect(queueMeetingReportPdfGeneration).toHaveBeenCalledTimes(1);
	});

	it('links the submission to an existing planned calendar event when eventId is provided', async () => {
		createFormSubmission.mockResolvedValueOnce({
			id: 31,
			employeeId: 7,
			submissionType: 'meeting',
			pdfLink: null,
			fields: {
				namaPegawai: 'Dendi',
				tanggalMeeting: '2026-05-15',
				judulMeeting: 'Rapat Planned',
				melaksanakanMeeting: 'Tidak',
				alasanTidakMeeting: 'lupa'
			},
			files: [],
			submittedAt: '2026-05-15 11:00:00'
		});
		findCalendarEventRowById.mockResolvedValueOnce({
			id: 17,
			title: 'Rapat Lama',
			startTime: '2026-05-15T09:00:00.000Z',
			endTime: '2026-05-15T10:00:00.000Z',
			formSubmissionId: null,
			isCancelled: false
		});

		const formData = new FormData();
		formData.set('namaPegawai', 'Dendi');
		formData.set('tanggalMeeting', '2026-05-15');
		formData.set('judulMeeting', 'Rapat Planned');
		formData.set('melaksanakanMeeting', 'Tidak');
		formData.set('alasanTidakMeeting', 'lupa');

		const { createMeetingFormSubmission } = await import(
			'../../../src/lib/server/meeting-form-submissions'
		);
		await createMeetingFormSubmission(formData, 7, 17);

		expect(insertCalendarEventRow).not.toHaveBeenCalled();
		expect(findCalendarEventRowById).toHaveBeenCalledWith(17);
		expect(updateCalendarEventRow).toHaveBeenCalledWith(17, {
			formSubmissionId: 31,
			title: 'Rapat Planned'
		});
		expect(queueMeetingReportPdfGeneration).toHaveBeenCalledTimes(1);
	});

	it('rejects linking to a cancelled calendar event', async () => {
		createFormSubmission.mockResolvedValueOnce({
			id: 32,
			employeeId: 7,
			submissionType: 'meeting',
			pdfLink: null,
			fields: {
				namaPegawai: 'Dendi',
				tanggalMeeting: '2026-05-15',
				judulMeeting: 'Rapat Planned',
				melaksanakanMeeting: 'Tidak',
				alasanTidakMeeting: 'lupa'
			},
			files: [],
			submittedAt: '2026-05-15 11:00:00'
		});
		findCalendarEventRowById.mockResolvedValueOnce({
			id: 17,
			title: 'Rapat Lama',
			startTime: '2026-05-15T09:00:00.000Z',
			endTime: '2026-05-15T10:00:00.000Z',
			formSubmissionId: null,
			isCancelled: true
		});

		const formData = new FormData();
		formData.set('namaPegawai', 'Dendi');
		formData.set('tanggalMeeting', '2026-05-15');
		formData.set('judulMeeting', 'Rapat Planned');
		formData.set('melaksanakanMeeting', 'Tidak');
		formData.set('alasanTidakMeeting', 'lupa');

		const { createMeetingFormSubmission } = await import(
			'../../../src/lib/server/meeting-form-submissions'
		);

		await expect(createMeetingFormSubmission(formData, 7, 17)).rejects.toThrow(
			'Cancelled event cannot be completed'
		);
		expect(updateCalendarEventRow).not.toHaveBeenCalled();
	});
});
