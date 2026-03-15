import { desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { formSubmissions } from '$lib/server/schema/form-submissions';

export type FormSubmissionRow = typeof formSubmissions.$inferSelect;
export type SubmissionType = 'upload-form' | 'meeting';

export async function insertFormSubmission(values: {
	submissionType: SubmissionType;
	pdfLink?: string | null;
	fieldsJson: string;
	filesJson: string;
}): Promise<FormSubmissionRow> {
	const [insertedRow] = await db.insert(formSubmissions).values(values).returning();

	if (!insertedRow) {
		throw new Error('Unable to retrieve created submission');
	}

	return insertedRow;
}

export async function updateFormSubmissionPdfLink(
	id: number,
	pdfLink: string | null
): Promise<FormSubmissionRow> {
	const [updatedRow] = await db
		.update(formSubmissions)
		.set({ pdfLink })
		.where(eq(formSubmissions.id, id))
		.returning();

	if (!updatedRow) {
		throw new Error('Unable to update form submission PDF link');
	}

	return updatedRow;
}

export function listFormSubmissionRows(submissionType?: SubmissionType): Promise<FormSubmissionRow[]> {
	const query = db.select().from(formSubmissions);

	if (submissionType) {
		return query
			.where(eq(formSubmissions.submissionType, submissionType))
			.orderBy(desc(formSubmissions.submittedAt), desc(formSubmissions.id));
	}

	return query.orderBy(desc(formSubmissions.submittedAt), desc(formSubmissions.id));
}