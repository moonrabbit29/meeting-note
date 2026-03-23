import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { formSubmissions } from './form-submissions';

export const calendarEvents = sqliteTable('calendar_events', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	startTime: text('start_time').notNull(),
	endTime: text('end_time').notNull(),
	formSubmissionId: integer('form_submission_id').references(() => formSubmissions.id),
	isCancelled: integer('is_cancelled', { mode: 'boolean' }).notNull().default(false),
	createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});
