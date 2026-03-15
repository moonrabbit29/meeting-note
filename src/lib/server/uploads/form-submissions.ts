import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

export interface UploadedFileRecord {
	fieldName: string;
	originalName: string;
	storedName: string;
	contentType: string;
	size: number;
	path: string;
}

const uploadsDirectoryPath = resolve(process.cwd(), 'static', 'uploads', 'form-submissions');
const maxFileSizeBytes = 10 * 1024 * 1024;

let uploadsDirectoryPromise: Promise<void> | undefined;

function sanitizeBaseName(fileName: string): string {
	return (
		fileName
			.replace(/\.[^.]+$/, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'upload'
	);
}

function sanitizeExtension(fileName: string): string {
	const extension = extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '');
	return extension.slice(0, 10);
}

async function ensureUploadsDirectory(): Promise<void> {
	if (!uploadsDirectoryPromise) {
		uploadsDirectoryPromise = mkdir(uploadsDirectoryPath, { recursive: true }).then(() => {});
	}

	await uploadsDirectoryPromise;
}

export async function persistUploadedFiles(formData: FormData): Promise<UploadedFileRecord[]> {
	await ensureUploadsDirectory();

	const uploadedFiles: UploadedFileRecord[] = [];

	for (const [fieldName, value] of formData.entries()) {
		if (typeof value === 'string' || value.size === 0) {
			continue;
		}

		if (value.size > maxFileSizeBytes) {
			throw new Error(`File \"${value.name}\" exceeds the 10 MB limit`);
		}

		const baseName = sanitizeBaseName(value.name);
		const extension = sanitizeExtension(value.name);
		const storedName = `${Date.now()}-${randomUUID()}-${baseName}${extension}`;
		const outputPath = resolve(uploadsDirectoryPath, storedName);
		const fileBuffer = Buffer.from(await value.arrayBuffer());

		await writeFile(outputPath, fileBuffer);

		uploadedFiles.push({
			fieldName,
			originalName: value.name,
			storedName,
			contentType: value.type || 'application/octet-stream',
			size: value.size,
			path: `/uploads/form-submissions/${storedName}`
		});
	}

	return uploadedFiles;
}