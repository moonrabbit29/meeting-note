import {
	createFormSubmission,
	findFormSubmissionById,
	listFormSubmissions,
	type FormSubmissionRecord
} from '$lib/server/form-submissions';
import {
	findCalendarEventRowById,
	insertCalendarEventRow,
	updateCalendarEventRow
} from '$lib/server/repositories/calendar-events';
import {
	generateMeetingReportPdf,
	queueMeetingReportPdfGeneration,
	queueMissingMeetingReportPdfGeneration
} from '$lib/server/pdf/meetingReportPdf';

type MeetingChoice = 'Ya' | 'Tidak';

function isDuplicateCalendarLinkError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message;

	return (
		message.includes('UNIQUE constraint failed: calendar_events.form_submission_id') ||
		message.includes('calendar_events_form_submission_id_unique')
	);
}

function readStringField(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

function readFileField(formData: FormData, key: string): File | null {
	const value = formData.get(key);
	return value instanceof File && value.size > 0 ? value : null;
}

function readSubmissionField(submission: FormSubmissionRecord, key: string): string {
	const value = submission.fields[key];

	if (Array.isArray(value)) {
		return value[0]?.trim() ?? '';
	}

	return value?.trim() ?? '';
}

function parseSubmittedAt(submittedAt: string): Date | null {
	const parsed = new Date(submittedAt.replace(' ', 'T'));

	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed;
}

function resolveCalendarTimes(submission: FormSubmissionRecord): { startTime: string; endTime: string } {
	const meetingDate = readSubmissionField(submission, 'tanggalMeeting');
	const dateOnlyMatch = meetingDate.match(/^\d{4}-\d{2}-\d{2}$/);

	if (dateOnlyMatch) {
		const startTime = `${meetingDate}T09:00:00.000Z`;
		const endTime = `${meetingDate}T10:00:00.000Z`;

		return { startTime, endTime };
	}

	const parsedMeetingDate = new Date(meetingDate);

	if (!Number.isNaN(parsedMeetingDate.getTime())) {
		const endDate = new Date(parsedMeetingDate.getTime() + 60 * 60 * 1000);

		return {
			startTime: parsedMeetingDate.toISOString(),
			endTime: endDate.toISOString()
		};
	}

	const submittedAtDate = parseSubmittedAt(submission.submittedAt) ?? new Date();
	const endDate = new Date(submittedAtDate.getTime() + 60 * 60 * 1000);

	return {
		startTime: submittedAtDate.toISOString(),
		endTime: endDate.toISOString()
	};
}

async function createCalendarEventForSubmission(submission: FormSubmissionRecord): Promise<void> {
	const title = readSubmissionField(submission, 'judulMeeting') || `Meeting Report #${submission.id}`;
	const { startTime, endTime } = resolveCalendarTimes(submission);

	try {
		await insertCalendarEventRow({
			title,
			startTime,
			endTime,
			formSubmissionId: submission.id,
			isCancelled: false
		});
	} catch (error) {
		// Idempotent safety: if linkage already exists, keep submission flow successful.
		if (isDuplicateCalendarLinkError(error)) {
			return;
		}

		throw new Error('Unable to create linked calendar event');
	}
}

async function linkSubmissionToExistingCalendarEvent(
	submission: FormSubmissionRecord,
	eventId: number
): Promise<void> {
	const event = await findCalendarEventRowById(eventId);

	if (!event) {
		throw new Error('Calendar event not found');
	}

	if (event.isCancelled) {
		throw new Error('Cancelled event cannot be completed');
	}

	if (event.formSubmissionId !== null) {
		throw new Error('Calendar event already has a report');
	}

	await updateCalendarEventRow(eventId, {
		formSubmissionId: submission.id,
		title: readSubmissionField(submission, 'judulMeeting') || event.title
	});
}

function validateMeetingSubmission(formData: FormData): void {
	const namaPegawai = readStringField(formData, 'namaPegawai');
	const tanggalMeeting = readStringField(formData, 'tanggalMeeting');
	const judulMeeting = readStringField(formData, 'judulMeeting');
	const deskripsiMeeting = readStringField(formData, 'deskripsiMeeting');
	const melaksanakanMeeting = readStringField(formData, 'melaksanakanMeeting') as MeetingChoice | '';
	const alasanTidakMeeting = readStringField(formData, 'alasanTidakMeeting');
	const alasanLainnya = readStringField(formData, 'alasanLainnya');
	const fotoMeeting = readFileField(formData, 'fotoMeeting');

	if (!namaPegawai) throw new Error('Nama pegawai wajib diisi');
	if (!tanggalMeeting) throw new Error('Tanggal meeting wajib diisi');
	if (!judulMeeting) throw new Error('Judul meeting wajib diisi');
	if (melaksanakanMeeting !== 'Ya' && melaksanakanMeeting !== 'Tidak') {
		throw new Error('Pilihan meeting wajib diisi');
	}

	if (melaksanakanMeeting === 'Ya') {
		if (!deskripsiMeeting) throw new Error('Deskripsi meeting wajib diisi');
		if (!fotoMeeting) throw new Error('Foto acara wajib diupload');
		if (!fotoMeeting.type.startsWith('image/')) {
			throw new Error('Hanya file gambar yang diperbolehkan');
		}
	}

	if (melaksanakanMeeting === 'Tidak') {
		if (!alasanTidakMeeting) {
			throw new Error('Alasan tidak meeting wajib dipilih');
		}

		if (alasanTidakMeeting === 'lainnya' && !alasanLainnya) {
			throw new Error('Alasan lainnya wajib diisi');
		}
	}
}

export async function createMeetingFormSubmission(
	formData: FormData,
	employeeId: number,
	eventId?: number
): Promise<FormSubmissionRecord> {
	validateMeetingSubmission(formData);
	const submission = await createFormSubmission(formData, employeeId, 'meeting');

	if (eventId !== undefined) {
		await linkSubmissionToExistingCalendarEvent(submission, eventId);
	} else {
		await createCalendarEventForSubmission(submission);
	}

	queueMeetingReportPdfGeneration(submission);

	return submission;
}

export function listMeetingFormSubmissions(): Promise<FormSubmissionRecord[]> {
	return listFormSubmissions('meeting');
}

export function backfillMeetingPdfReports(): Promise<number> {
	return queueMissingMeetingReportPdfGeneration();
}

export async function regenerateMeetingPdfReport(submissionId: number): Promise<string> {
	if (!Number.isInteger(submissionId) || submissionId <= 0) {
		throw new Error('Submission id must be a positive integer');
	}

	const submission = await findFormSubmissionById(submissionId);

	if (!submission || submission.submissionType !== 'meeting') {
		throw new Error('Meeting submission not found');
	}

	// Regeneration updates the same DB row (pdf_link) and rewrites same output filename.
	return generateMeetingReportPdf(submission);
}