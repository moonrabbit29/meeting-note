import { describe, expect, it } from 'vitest';

import {
	getCalendarEventState,
	getCalendarEventUi,
	type CalendarEventDomainModel
} from '../../../src/lib/calendar/event-state';

function buildEvent(overrides: Partial<CalendarEventDomainModel> = {}): CalendarEventDomainModel {
	return {
		id: 1,
		title: 'Rapat Koordinasi',
		startTime: '2026-05-15T09:00:00.000Z',
		endTime: '2026-05-15T10:00:00.000Z',
		formSubmissionId: null,
		isCancelled: false,
		...overrides
	};
}

describe('calendar event state resolution', () => {
	it('returns cancelled when event is marked as cancelled', () => {
		const now = new Date('2026-05-15T09:30:00.000Z');
		const event = buildEvent({
			isCancelled: true,
			endTime: '2026-05-15T08:00:00.000Z',
			formSubmissionId: null
		});

		expect(getCalendarEventState(event, now)).toBe('cancelled');
	});

	it('returns completed when report submission exists', () => {
		const now = new Date('2026-05-15T11:00:00.000Z');
		const event = buildEvent({
			formSubmissionId: 99,
			endTime: '2026-05-15T08:30:00.000Z'
		});

		expect(getCalendarEventState(event, now)).toBe('completed');
	});

	it('returns action-required when meeting is in the past without submission', () => {
		const now = new Date('2026-05-15T11:00:00.000Z');
		const event = buildEvent({
			formSubmissionId: null,
			endTime: '2026-05-15T08:30:00.000Z',
			isCancelled: false
		});

		expect(getCalendarEventState(event, now)).toBe('action-required');
	});

	it('returns planned when meeting is still in the future and not linked', () => {
		const now = new Date('2026-05-15T08:00:00.000Z');
		const event = buildEvent({
			formSubmissionId: null,
			endTime: '2026-05-15T10:00:00.000Z',
			isCancelled: false
		});

		expect(getCalendarEventState(event, now)).toBe('planned');
	});
});

describe('calendar event UI behavior', () => {
	it('maps planned events to dashed styling and edit action', () => {
		const now = new Date('2026-05-15T08:00:00.000Z');
		const event = buildEvent();
		const ui = getCalendarEventUi(event, now);

		expect(ui.state).toBe('planned');
		expect(ui.clickAction).toEqual({ type: 'open-edit-modal' });
		expect(ui.classNames).toEqual(expect.arrayContaining(['event-planned', 'event-dashed']));
	});

	it('maps action-required events to warning styling and report redirect', () => {
		const now = new Date('2026-05-15T11:00:00.000Z');
		const event = buildEvent({ endTime: '2026-05-15T08:00:00.000Z' });
		const ui = getCalendarEventUi(event, now);

		expect(ui.state).toBe('action-required');
		expect(ui.clickAction).toEqual({
			type: 'redirect',
			href: '/form-laporan?eventId=1'
		});
		expect(ui.classNames).toEqual(expect.arrayContaining(['event-action-required']));
	});

	it('maps completed events to success styling and read-only report modal', () => {
		const now = new Date('2026-05-15T11:00:00.000Z');
		const event = buildEvent({
			formSubmissionId: 44,
			endTime: '2026-05-15T08:00:00.000Z'
		});
		const ui = getCalendarEventUi(event, now);

		expect(ui.state).toBe('completed');
		expect(ui.clickAction).toEqual({ type: 'open-report-view', formSubmissionId: 44 });
		expect(ui.classNames).toEqual(expect.arrayContaining(['event-completed']));
	});

	it('maps cancelled events to faded strikethrough styling and no action', () => {
		const now = new Date('2026-05-15T11:00:00.000Z');
		const event = buildEvent({ isCancelled: true });
		const ui = getCalendarEventUi(event, now);

		expect(ui.state).toBe('cancelled');
		expect(ui.clickAction).toEqual({ type: 'none' });
		expect(ui.classNames).toEqual(expect.arrayContaining(['event-cancelled', 'event-strikethrough']));
	});
});