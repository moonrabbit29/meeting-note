import type { EventInput } from '@fullcalendar/core';

export type MeetingExecutionStatus = 'Ya' | 'Tidak' | 'Tidak diketahui';

export type MeetingNoteCalendarEvent = EventInput & {
	id: string;
	title: string;
	start: string;
	allDay: true;
	backgroundColor: string;
	borderColor: string;
	textColor: string;
	extendedProps: {
		submissionId: number;
		employeeName: string;
		executionStatus: MeetingExecutionStatus;
		meetingDate: string;
		description: string;
		pdfLink: string | null;
	};
};