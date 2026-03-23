import { asc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { calendarEvents } from '$lib/server/schema/calendar-events';

export type CalendarEventRow = typeof calendarEvents.$inferSelect;

export function listCalendarEventRows(): Promise<CalendarEventRow[]> {
	return db
		.select()
		.from(calendarEvents)
		.orderBy(asc(calendarEvents.startTime), asc(calendarEvents.id));
}

export async function findCalendarEventRowById(id: number): Promise<CalendarEventRow | null> {
	const [row] = await db
		.select()
		.from(calendarEvents)
		.where(eq(calendarEvents.id, id))
		.limit(1);

	return row ?? null;
}

export async function insertCalendarEventRow(values: {
	title: string;
	startTime: string;
	endTime: string;
	formSubmissionId?: number | null;
	isCancelled?: boolean;
}): Promise<CalendarEventRow> {
	const [row] = await db.insert(calendarEvents).values(values).returning();

	if (!row) {
		throw new Error('Unable to create calendar event');
	}

	return row;
}

export async function updateCalendarEventRow(
	id: number,
	values: Partial<Pick<CalendarEventRow, 'title' | 'startTime' | 'endTime' | 'isCancelled' | 'formSubmissionId'>>
): Promise<CalendarEventRow> {
	const [row] = await db
		.update(calendarEvents)
		.set({
			...values,
			updatedAt: new Date().toISOString()
		})
		.where(eq(calendarEvents.id, id))
		.returning();

	if (!row) {
		throw new Error('Unable to update calendar event');
	}

	return row;
}
