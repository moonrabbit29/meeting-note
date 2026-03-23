export type CalendarEventState = 'planned' | 'action-required' | 'completed' | 'cancelled';

export type CalendarEventDomainModel = {
	id: number;
	title: string;
	startTime: string;
	endTime: string;
	formSubmissionId: number | null;
	isCancelled: boolean;
};

export type CalendarEventClickAction =
	| { type: 'open-edit-modal' }
	| { type: 'redirect'; href: string }
	| { type: 'open-report-view'; formSubmissionId: number }
	| { type: 'none' };

export type CalendarEventUi = {
	state: CalendarEventState;
	classNames: string[];
	clickAction: CalendarEventClickAction;
};

function toDate(value: string): Date {
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		throw new Error('Invalid date value');
	}

	return parsed;
}

export function getCalendarEventState(
	event: CalendarEventDomainModel,
	now: Date = new Date()
): CalendarEventState {
	if (event.isCancelled) {
		return 'cancelled';
	}

	if (event.formSubmissionId !== null) {
		return 'completed';
	}

	if (toDate(event.endTime).getTime() < now.getTime()) {
		return 'action-required';
	}

	return 'planned';
}

export function getCalendarEventUi(
	event: CalendarEventDomainModel,
	now: Date = new Date()
): CalendarEventUi {
	const state = getCalendarEventState(event, now);

	if (state === 'cancelled') {
		return {
			state,
			classNames: ['event-cancelled', 'event-strikethrough', 'event-faded'],
			clickAction: { type: 'none' }
		};
	}

	if (state === 'completed') {
		return {
			state,
			classNames: ['event-completed'],
			clickAction: {
				type: 'open-report-view',
				formSubmissionId: event.formSubmissionId as number
			}
		};
	}

	if (state === 'action-required') {
		return {
			state,
			classNames: ['event-action-required'],
			clickAction: {
				type: 'redirect',
				href: `/form-laporan?eventId=${event.id}`
			}
		};
	}

	return {
		state,
		classNames: ['event-planned', 'event-dashed'],
		clickAction: { type: 'open-edit-modal' }
	};
}
