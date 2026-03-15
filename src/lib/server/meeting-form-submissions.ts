import { createFormSubmission, listFormSubmissions, type FormSubmissionRecord } from '$lib/server/form-submissions';
import { queueMeetingReportPdfGeneration } from '$lib/server/pdf/meetingReportPdf';

type MeetingChoice = 'Ya' | 'Tidak';

function readStringField(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

function readFileField(formData: FormData, key: string): File | null {
	const value = formData.get(key);
	return value instanceof File && value.size > 0 ? value : null;
}

function validateMeetingSubmission(formData: FormData): void {
	const namaPegawai = readStringField(formData, 'namaPegawai');
	const nomorPegawaian = readStringField(formData, 'nomorPegawaian');
	const tanggalMeeting = readStringField(formData, 'tanggalMeeting');
	const judulMeeting = readStringField(formData, 'judulMeeting');
	const deskripsiMeeting = readStringField(formData, 'deskripsiMeeting');
	const melaksanakanMeeting = readStringField(formData, 'melaksanakanMeeting') as MeetingChoice | '';
	const alasanTidakMeeting = readStringField(formData, 'alasanTidakMeeting');
	const alasanLainnya = readStringField(formData, 'alasanLainnya');
	const fotoMeeting = readFileField(formData, 'fotoMeeting');

	if (!namaPegawai) throw new Error('Nama pegawai wajib diisi');
	if (!nomorPegawaian) throw new Error('Nomor pegawaian wajib diisi');
	if (!/^\d+$/.test(nomorPegawaian)) throw new Error('Hanya boleh input angka untuk nomor pegawaian');
	if (!tanggalMeeting) throw new Error('Tanggal meeting wajib diisi');
	if (!judulMeeting) throw new Error('Judul meeting wajib diisi');
	if (melaksanakanMeeting !== 'Ya' && melaksanakanMeeting !== 'Tidak') {
		throw new Error('Pilihan meeting wajib diisi');
	}

	if (melaksanakanMeeting === 'Ya') {
		if (!deskripsiMeeting) throw new Error('Deskripsi meeting wajib diisi');
		if (!fotoMeeting) throw new Error('Foto acara wajib diupload');
		if (!fotoMeeting.type.startsWith('image/')) {
			throw new Error('Hanya file gambar yang diperbolehkan');
		}
	}

	if (melaksanakanMeeting === 'Tidak') {
		if (!alasanTidakMeeting) {
			throw new Error('Alasan tidak meeting wajib dipilih');
		}

		if (alasanTidakMeeting === 'lainnya' && !alasanLainnya) {
			throw new Error('Alasan lainnya wajib diisi');
		}
	}
}

export async function createMeetingFormSubmission(formData: FormData): Promise<FormSubmissionRecord> {
	validateMeetingSubmission(formData);
	const submission = await createFormSubmission(formData, 'meeting');

	queueMeetingReportPdfGeneration(submission);

	return submission;
}

export function listMeetingFormSubmissions(): Promise<FormSubmissionRecord[]> {
	return listFormSubmissions('meeting');
}