import { createFormSubmission, findFormSubmissionById, type FormSubmissionRecord } from '$lib/server/form-submissions';
import {
	findCalendarEventRowById,
	insertCalendarEventRow,
	listCalendarEventRows,
	updateCalendarEventRow,
	type CalendarEventRow
} from '$lib/server/repositories/calendar-events';
import { queueMeetingReportPdfGeneration } from '$lib/server/pdf/meetingReportPdf';

type ReportSummary = {
	id: number;
	submittedAt: string;
	fields: Record<string, string | string[]>;
	pdfLink: string | null;
};

export type CalendarEventWithReport = {
	id: number;
	title: string;
	startTime: string;
	endTime: string;
	formSubmissionId: number | null;
	isCancelled: boolean;
	reportSummary: ReportSummary | null;
};

function toIsoString(value: string): string {
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		throw new Error('Invalid date time value');
	}

	return parsed.toISOString();
}

function isPlanned(row: CalendarEventRow, now: Date): boolean {
	if (row.isCancelled || row.formSubmissionId !== null) {
		return false;
	}

	return new Date(row.endTime).getTime() > now.getTime();
}

function toEventWithReport(
	row: CalendarEventRow,
	submission: FormSubmissionRecord | null
): CalendarEventWithReport {
	return {
		id: row.id,
		title: row.title,
		startTime: row.startTime,
		endTime: row.endTime,
		formSubmissionId: row.formSubmissionId,
		isCancelled: row.isCancelled,
		reportSummary: submission
			? {
					id: submission.id,
					submittedAt: submission.submittedAt,
					fields: submission.fields,
					pdfLink: submission.pdfLink
				}
			: null
	};
}

export async function listCalendarEventsWithReports(): Promise<CalendarEventWithReport[]> {
	const rows = await listCalendarEventRows();
	const submissionIds = [
		...new Set(rows.map((row) => row.formSubmissionId).filter((id): id is number => id !== null))
	];

	const submissions = await Promise.all(submissionIds.map((id) => findFormSubmissionById(id)));
	const byId = new Map<number, FormSubmissionRecord>();

	for (const submission of submissions) {
		if (submission) {
			byId.set(submission.id, submission);
		}
	}

	return rows.map((row) =>
		toEventWithReport(row, row.formSubmissionId ? byId.get(row.formSubmissionId) ?? null : null)
	);
}

export async function findCalendarEventWithReportById(
	eventId: number
): Promise<CalendarEventWithReport | null> {
	const row = await findCalendarEventRowById(eventId);

	if (!row) {
		return null;
	}

	const submission = row.formSubmissionId ? await findFormSubmissionById(row.formSubmissionId) : null;

	return toEventWithReport(row, submission);
}

export async function createSpontaneousMeetingWithCalendarEvent(input: {
	employeeId: number;
	title: string;
	startTime: string;
	endTime: string;
	namaPegawai: string;
	deskripsiMeeting: string;
}): Promise<{ calendarEventId: number; formSubmissionId: number }> {
	const startTime = toIsoString(input.startTime);
	const endTime = toIsoString(input.endTime);

	if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
		throw new Error('endTime must be after startTime');
	}

	const formData = new FormData();
	formData.set('namaPegawai', input.namaPegawai.trim());
	formData.set('tanggalMeeting', startTime.slice(0, 10));
	formData.set('judulMeeting', input.title.trim());
	formData.set('deskripsiMeeting', input.deskripsiMeeting.trim());
	formData.set('melaksanakanMeeting', 'Ya');

	const submission = await createFormSubmission(formData, input.employeeId, 'meeting');
	const event = await insertCalendarEventRow({
		title: input.title.trim(),
		startTime,
		endTime,
		formSubmissionId: submission.id,
		isCancelled: false
	});

	queueMeetingReportPdfGeneration(submission);

	return {
		calendarEventId: event.id,
		formSubmissionId: submission.id
	};
}

export async function createPlannedCalendarEvent(input: {
	title: string;
	startTime: string;
	endTime: string;
}): Promise<CalendarEventWithReport> {
	const startTime = toIsoString(input.startTime);
	const endTime = toIsoString(input.endTime);

	if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
		throw new Error('endTime must be after startTime');
	}

	const event = await insertCalendarEventRow({
		title: input.title.trim(),
		startTime,
		endTime,
		formSubmissionId: null,
		isCancelled: false
	});

	return toEventWithReport(event, null);
}

export async function updatePlannedCalendarEventDetails(input: {
	eventId: number;
	title: string;
	startTime: string;
	endTime: string;
}): Promise<CalendarEventWithReport> {
	const existing = await findCalendarEventRowById(input.eventId);

	if (!existing) {
		throw new Error('Calendar event not found');
	}

	if (!isPlanned(existing, new Date())) {
		throw new Error('Only planned events can be edited');
	}

	const updated = await updateCalendarEventRow(input.eventId, {
		title: input.title.trim(),
		startTime: toIsoString(input.startTime),
		endTime: toIsoString(input.endTime)
	});

	return toEventWithReport(updated, null);
}

export async function cancelPlannedCalendarEvent(eventId: number): Promise<CalendarEventWithReport> {
	const existing = await findCalendarEventRowById(eventId);

	if (!existing) {
		throw new Error('Calendar event not found');
	}

	if (!isPlanned(existing, new Date())) {
		throw new Error('Only planned events can be cancelled');
	}

	const updated = await updateCalendarEventRow(eventId, { isCancelled: true });

	return toEventWithReport(updated, null);
}
