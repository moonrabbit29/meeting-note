import {
	insertFormSubmission,
	listFormSubmissionRows,
	type FormSubmissionRow,
    type SubmissionType
} from '$lib/server/repositories/form-submissions';
import {
	persistUploadedFiles,
	type UploadedFileRecord
} from '$lib/server/uploads/form-submissions';


export interface FormSubmissionRecord {
	id: number;
	submissionType: SubmissionType;
	pdfLink: string | null;
	fields: Record<string, string | string[]>;
	files: UploadedFileRecord[];
	submittedAt: string;
}

function appendField(
	fields: Record<string, string | string[]>,
	key: string,
	value: string
): void {
	const existingValue = fields[key];

	if (existingValue === undefined) {
		fields[key] = value;
		return;
	}

	if (Array.isArray(existingValue)) {
		existingValue.push(value);
		return;
	}

	fields[key] = [existingValue, value];
}

function parseJson<T>(value: string): T {
	return JSON.parse(value) as T;
}

function toSubmissionType(value: string): SubmissionType {
	if (value === 'meeting') {
		return 'meeting';
	}

	return 'upload-form';
}

function toSubmissionRecord(row: FormSubmissionRow): FormSubmissionRecord {
	return {
		id: row.id,
		submissionType: toSubmissionType(row.submissionType),
		pdfLink: row.pdfLink,
		fields: parseJson<Record<string, string | string[]>>(row.fieldsJson),
		files: parseJson<UploadedFileRecord[]>(row.filesJson),
		submittedAt: row.submittedAt
	};
}

function extractFields(formData: FormData): Record<string, string | string[]> {
	const fields: Record<string, string | string[]> = {};

	for (const [key, value] of formData.entries()) {
		if (typeof value !== 'string') {
			continue;
		}

		const trimmedValue = value.trim();

		if (trimmedValue.length === 0) {
			continue;
		}

		appendField(fields, key, trimmedValue);
	}

	return fields;
}

export async function createFormSubmission(
	formData: FormData,
	submissionType: 'upload-form' | 'meeting' = 'upload-form'
): Promise<FormSubmissionRecord> {
	const fields = extractFields(formData);
	const files = await persistUploadedFiles(formData);

	if (Object.keys(fields).length === 0 && files.length === 0) {
		throw new Error('Form submission must include at least one non-empty field or file');
	}

	const insertedRow = await insertFormSubmission({
		submissionType,
		pdfLink: null,
		fieldsJson: JSON.stringify(fields),
		filesJson: JSON.stringify(files)
	});

	return toSubmissionRecord(insertedRow);
}

export async function listFormSubmissions(
	submissionType?: 'upload-form' | 'meeting'
): Promise<FormSubmissionRecord[]> {
	const rows = await listFormSubmissionRows(submissionType);

	return rows.map(toSubmissionRecord);
}