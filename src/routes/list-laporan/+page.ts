import type { PageLoad } from './$types';

type SubmissionFile = {
	fieldName: string;
	originalName: string;
	storedName: string;
	contentType: string;
	size: number;
	path: string;
};

type SubmissionRecord = {
	id: number;
	submissionType: string;
	fields: Record<string, string | string[]>;
	files: SubmissionFile[];
	submittedAt: string;
	pdfLink: string | null;
};

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch('/api/form-submission');

	if (!response.ok) {
		return {
			submissions: [] as SubmissionRecord[],
			loadError: 'Gagal memuat daftar laporan meeting.'
		};
	}

	const data = (await response.json()) as { submissions: SubmissionRecord[] };

	return {
		submissions: data.submissions,
		loadError: null
	};
};