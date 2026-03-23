import { listMeetingFormSubmissions } from '$lib/server/meeting-form-submissions';
import type { FormSubmissionRecord } from '$lib/server/form-submissions';
import type {
	MeetingExecutionStatus,
	MeetingNoteCalendarEvent
} from '$lib/types/meeting-calendar';

const statusTheme: Record<MeetingExecutionStatus, { backgroundColor: string; borderColor: string }> = {
	Ya: {
		backgroundColor: '#0f766e',
		borderColor: '#115e59'
	},
	Tidak: {
		backgroundColor: '#b45309',
		borderColor: '#92400e'
	},
	'Tidak diketahui': {
		backgroundColor: '#1d4ed8',
		borderColor: '#1e40af'
	}
};

function readFieldValue(fields: FormSubmissionRecord['fields'], key: string): string {
	const value = fields[key];

	if (Array.isArray(value)) {
		return value[0]?.trim() ?? '';
	}

	return value?.trim() ?? '';
}

function stripHtml(value: string): string {
	return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDateOnly(value: string): string | null {
	const trimmedValue = value.trim();

	if (!trimmedValue) {
		return null;
	}

	const dateOnlyMatch = trimmedValue.match(/^\d{4}-\d{2}-\d{2}$/);

	if (dateOnlyMatch) {
		return trimmedValue;
	}

	const dateTimeMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})[ T]/);

	if (dateTimeMatch) {
		return dateTimeMatch[1];
	}

	const parsedDate = new Date(trimmedValue.replace(' ', 'T'));

	if (Number.isNaN(parsedDate.getTime())) {
		return null;
	}

	return parsedDate.toISOString().slice(0, 10);
}

function resolveExecutionStatus(submission: FormSubmissionRecord): MeetingExecutionStatus {
	const rawStatus = readFieldValue(submission.fields, 'melaksanakanMeeting');

	if (rawStatus === 'Ya' || rawStatus === 'Tidak') {
		return rawStatus;
	}

	return 'Tidak diketahui';
}

export function toMeetingNoteCalendarEvent(
	submission: FormSubmissionRecord
): MeetingNoteCalendarEvent | null {
	const meetingDate =
		normalizeDateOnly(readFieldValue(submission.fields, 'tanggalMeeting')) ??
		normalizeDateOnly(submission.submittedAt);

	if (!meetingDate) {
		return null;
	}

	const executionStatus = resolveExecutionStatus(submission);
	const description = stripHtml(readFieldValue(submission.fields, 'deskripsiMeeting'));
	const theme = statusTheme[executionStatus];

	return {
		id: String(submission.id),
		title: readFieldValue(submission.fields, 'judulMeeting') || `Meeting #${submission.id}`,
		start: meetingDate,
		allDay: true,
		backgroundColor: theme.backgroundColor,
		borderColor: theme.borderColor,
		textColor: '#fff8ef',
		extendedProps: {
			submissionId: submission.id,
			employeeName: readFieldValue(submission.fields, 'namaPegawai') || 'Tidak diketahui',
			executionStatus,
			meetingDate,
			description,
			pdfLink: submission.pdfLink
		}
	};
}

export async function listMeetingNoteCalendarEvents(): Promise<MeetingNoteCalendarEvent[]> {
	const submissions = await listMeetingFormSubmissions();

	return submissions
		.map(toMeetingNoteCalendarEvent)
		.filter((event): event is MeetingNoteCalendarEvent => event !== null)
		.sort((left, right) => left.start.localeCompare(right.start) || left.id.localeCompare(right.id));
}