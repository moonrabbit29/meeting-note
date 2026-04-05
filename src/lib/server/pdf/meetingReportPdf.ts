import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

import {
	listFormSubmissionsMissingPdf,
	type FormSubmissionRecord
} from '$lib/server/form-submissions';
import { updateFormSubmissionPdfLink } from '$lib/server/repositories/form-submissions';

import { generatePdf } from './generatedPdf';

const staticRoot = process.env.PDF_STATIC_ROOT ?? 'static';
const generatedPdfDirectory = resolve(process.cwd(), staticRoot, 'generated-pdfs', 'meeting-reports');
const reportLogoPath = resolve(
	process.cwd(),
	'src',
	'lib',
	'assets',
	'form_images',
	'Nusa Tenggara barat.svg'
);

let pdfDirectoryPromise: Promise<void> | undefined;

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function normalizeQuillHtml(html: string): string {
	// Already has proper list wrappers (from getSemanticHTML) — leave as-is.
	if (/<[uo]l[\s>]/i.test(html)) {
		return html;
	}

	// Quill's root.innerHTML produces flat <li data-list="..."> without <ul>/<ol>.
	// Group consecutive items by type into proper list containers.
	return html
		.replace(/(<li\s+data-list="bullet">.*?<\/li>\s*)+/gs, '<ul>$&</ul>')
		.replace(/(<li\s+data-list="ordered">.*?<\/li>\s*)+/gs, '<ol>$&</ol>');
}

function readField(fields: Record<string, string | string[]>, key: string): string {
	const value = fields[key];

	if (Array.isArray(value)) {
		return value.join(', ');
	}

	return value ?? '';
}

function formatDisplayDate(value: string): string {
	if (!value) {
		return '-';
	}

	const date = new Date(`${value}T00:00:00`);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat('id-ID', {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(date);
}

async function ensurePdfDirectory(): Promise<void> {
	if (!pdfDirectoryPromise) {
		pdfDirectoryPromise = mkdir(generatedPdfDirectory, { recursive: true }).then(() => {});
	}

	await pdfDirectoryPromise;
}

async function toImageTag(publicPath: string, label: string): Promise<string> {
	const absolutePath = resolve(process.cwd(), 'static', publicPath.replace(/^(\/)+/, ''));
	let buffer: Buffer;

	try {
		buffer = await readFile(absolutePath);
	} catch (error) {
		console.error('Failed to read submission image for PDF', {
			publicPath,
			absolutePath,
			label,
			error
		});
		throw error;
	}
	const extension = extname(absolutePath).slice(1).toLowerCase() || 'jpeg';
	const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
	const base64 = buffer.toString('base64');

	return `<img src="data:${mimeType};base64,${base64}" alt="${escapeHtml(label)}" />`;
}

async function buildPhotoMarkup(submission: FormSubmissionRecord): Promise<string> {
	if (submission.files.length === 0) {
		return '<p>Tidak ada dokumentasi terlampir.</p>';
	}

	const tags = await Promise.all(
		submission.files.map((file) => toImageTag(file.path, file.originalName || basename(file.path)))
	);

	return tags.join('');
}

async function buildLogoMarkup(): Promise<string> {
	let buffer: Buffer;

	try {
		buffer = await readFile(reportLogoPath);
	} catch (error) {
		console.error('Failed to read meeting report logo for PDF', {
			reportLogoPath,
			error
		});
		throw error;
	}
	const base64 = buffer.toString('base64');

	return `<img src="data:image/svg+xml;base64,${base64}" alt="Logo Provinsi Nusa Tenggara Barat" />`;
}

function buildDescription(submission: FormSubmissionRecord): string {
	const status = readField(submission.fields, 'melaksanakanMeeting');

	if (status === 'Ya') {
		return readField(submission.fields, 'deskripsiMeeting') || '-';
	}

	const alasanTidakMeeting = readField(submission.fields, 'alasanTidakMeeting');
	const alasanLainnya = readField(submission.fields, 'alasanLainnya');

	return alasanLainnya || alasanTidakMeeting || '-';
}

function buildTemplateData(
	submission: FormSubmissionRecord,
	photos: string,
	logoMarkup: string
): Record<string, string> {
	const status = readField(submission.fields, 'melaksanakanMeeting');
	const description = buildDescription(submission);
	const descriptionMarkup = status === 'Ya' ? normalizeQuillHtml(description) : escapeHtml(description);

	return {
		logo_markup: logoMarkup,
		employee_name: escapeHtml(readField(submission.fields, 'namaPegawai') || '-'),
		employee_id: escapeHtml(readField(submission.fields, 'nomorPegawaian') || '-'),
		meeting_date: escapeHtml(formatDisplayDate(readField(submission.fields, 'tanggalMeeting'))),
		meeting_title: escapeHtml(readField(submission.fields, 'judulMeeting') || '-'),
		meeting_status: escapeHtml(readField(submission.fields, 'melaksanakanMeeting') || '-'),
		description: descriptionMarkup,
		photos
	};
}

export async function generateMeetingReportPdf(submission: FormSubmissionRecord): Promise<string> {
	const outputFileName = `meeting-report-${submission.id}.pdf`;
	const outputPath = resolve(generatedPdfDirectory, outputFileName);
	const publicPath = `/generated-pdfs/meeting-reports/${outputFileName}`;

	try {
		await ensurePdfDirectory();
		const photos = await buildPhotoMarkup(submission);
		const logoMarkup = await buildLogoMarkup();
		const templateData = buildTemplateData(submission, photos, logoMarkup);
		const pdfBuffer = await generatePdf(templateData, 'laporan.html');

		await writeFile(outputPath, pdfBuffer);
		await updateFormSubmissionPdfLink(submission.id, publicPath);

		return publicPath;
	} catch (error) {
		console.error('Failed to generate meeting report PDF', {
			submissionId: submission.id,
			outputPath,
			publicPath,
			fileCount: submission.files.length,
			error
		});
		throw error;
	}
}

export function queueMeetingReportPdfGeneration(submission: FormSubmissionRecord): void {
	void (async () => {
		try {
			await generateMeetingReportPdf(submission);
		} catch (error) {
			console.error('Failed to generate meeting PDF', {
				submissionId: submission.id,
				error
			});
		}
	})();
}

let backfillPromise: Promise<number> | null = null;

export function queueMissingMeetingReportPdfGeneration(): Promise<number> {
	if (!backfillPromise) {
		backfillPromise = (async () => {
			const submissions = await listFormSubmissionsMissingPdf('meeting');
			let processed = 0;

			for (const submission of submissions) {
				await generateMeetingReportPdf(submission);
				processed += 1;
			}

			return processed;
		})().finally(() => {
			backfillPromise = null;
		});
	}

	return backfillPromise;
}