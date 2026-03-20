import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const formSubmissions = sqliteTable('form_submissions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	employeeId: integer('employee_id'),
	submissionType: text('submission_type', {
		enum: ['upload-form', 'meeting']
	}).notNull().default('upload-form'),
	pdfLink: text('pdf_link'),
	fieldsJson: text('fields_json').notNull(),
	filesJson: text('files_json').notNull(),
	submittedAt: text('submitted_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});