// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const importAttributor = vi.fn((path: string) => {
	if (path === 'attributors/style/font') {
		return { whitelist: [] as string[] };
	}

	if (path === 'attributors/style/align') {
		return {};
	}

	return {};
});

const registerAttributor = vi.fn();

vi.mock('quill', () => {
	class MockQuill {
		root = document.createElement('div');
		on = vi.fn();
		setContents = vi.fn();
		disable = vi.fn();
		getSemanticHTML = vi.fn(() => '<p><br></p>');

		constructor(_node: HTMLElement, _options: unknown) {}

		static import = importAttributor;
		static register = registerAttributor;
	}

	return {
		default: MockQuill
	};
});

describe('/form-laporan page', () => {
	afterEach(() => {
		cleanup();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
		sessionStorage.setItem('meeting-note-employee-id', 'EMP-007');
		window.history.replaceState({}, '', '/form-laporan');
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({})
		}) as unknown as typeof fetch;
	});

	it('loads employeeId from session storage', async () => {
		const Page = (await import('../../src/routes/form-laporan/+page.svelte')).default;
		render(Page);

		const employeeInput = (await screen.findByPlaceholderText(
			'Auto dari session'
		)) as HTMLInputElement;
		expect(employeeInput.value).toBe('EMP-007');
	});

	it('submits the Tidak flow and sends expected FormData fields', async () => {
		const Page = (await import('../../src/routes/form-laporan/+page.svelte')).default;
		const { container } = render(Page);

		await fireEvent.input(screen.getByPlaceholderText('Masukkan nama pegawai'), {
			target: { value: 'Dendi' }
		});
		await fireEvent.input(screen.getByPlaceholderText('Masukkan judul meeting'), {
			target: { value: 'Rapat Evaluasi' }
		});

		const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement | null;
		expect(dateInput).toBeTruthy();
		await fireEvent.input(dateInput as HTMLInputElement, {
			target: { value: '2026-03-20' }
		});

		await fireEvent.click(screen.getByDisplayValue('Tidak'));
		await fireEvent.click(await screen.findByDisplayValue('lupa'));
		await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() => {
			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		});

		const [url, requestInit] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			RequestInit
		];

		expect(url).toBe('/api/form-submission');
		expect(requestInit.method).toBe('POST');
		expect(requestInit.body).toBeInstanceOf(FormData);

		const payload = requestInit.body as FormData;
		expect(payload.get('employeeId')).toBe('EMP-007');
		expect(payload.get('namaPegawai')).toBe('Dendi');
		expect(payload.get('tanggalMeeting')).toBe('2026-03-20');
		expect(payload.get('judulMeeting')).toBe('Rapat Evaluasi');
		expect(payload.get('melaksanakanMeeting')).toBe('Tidak');
		expect(payload.get('alasanTidakMeeting')).toBe('lupa');

		expect(screen.getByText('Form berhasil disubmit')).toBeTruthy();
	});

	it('prefills and locks title/date when eventId is present', async () => {
		window.history.replaceState({}, '', '/form-laporan?eventId=17');
		globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
			const url = String(input);

			if (url === '/api/calendar?eventId=17') {
				return {
					ok: true,
					json: async () => ({
						event: {
							id: 17,
							title: 'Rapat Tindak Lanjut',
							startTime: '2026-03-21T09:00:00.000Z'
						}
					})
				} as Response;
			}

			return {
				ok: true,
				json: async () => ({})
			} as Response;
		}) as unknown as typeof fetch;

		const Page = (await import('../../src/routes/form-laporan/+page.svelte')).default;
		const { container } = render(Page);

		const titleInput = (await screen.findByPlaceholderText(
			'Masukkan judul meeting'
		)) as HTMLInputElement;
		const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement | null;

		await waitFor(() => {
			expect(titleInput.value).toBe('Rapat Tindak Lanjut');
			expect((dateInput as HTMLInputElement).value).toBe('2026-03-21');
		});

		expect(titleInput.readOnly).toBe(true);
		expect(dateInput).toBeTruthy();
		expect((dateInput as HTMLInputElement).disabled).toBe(true);
	});

	it('submits eventId when completing a planned meeting', async () => {
		window.history.replaceState({}, '', '/form-laporan?eventId=17');
		globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
			const url = String(input);

			if (url === '/api/calendar?eventId=17') {
				return {
					ok: true,
					json: async () => ({
						event: {
							id: 17,
							title: 'Rapat Tindak Lanjut',
							startTime: '2026-03-21T09:00:00.000Z'
						}
					})
				} as Response;
			}

			return {
				ok: true,
				json: async () => ({})
			} as Response;
		}) as unknown as typeof fetch;

		const Page = (await import('../../src/routes/form-laporan/+page.svelte')).default;
		render(Page);

		await fireEvent.input(screen.getByPlaceholderText('Masukkan nama pegawai'), {
			target: { value: 'Dendi' }
		});
		await fireEvent.click(screen.getByDisplayValue('Tidak'));
		await fireEvent.click(await screen.findByDisplayValue('lupa'));
		await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() => {
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		const [, requestInit] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1] as [
			string,
			RequestInit
		];
		const payload = requestInit.body as FormData;

		expect(payload.get('eventId')).toBe('17');
		expect(payload.get('judulMeeting')).toBe('Rapat Tindak Lanjut');
		expect(payload.get('tanggalMeeting')).toBe('2026-03-21');
	});
});
