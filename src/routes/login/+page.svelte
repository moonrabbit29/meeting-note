<script lang="ts">
	import { goto } from '$app/navigation';

	type LoginForm = {
		email: string;
		password: string;
	};

	let form = $state<LoginForm>({
		email: '',
		password: ''
	});
	let errorMessage = $state<string | null>(null);
	let isSubmitting = $state(false);

	function persistSession(role: string, employeeId: number): void {
		if (typeof window === 'undefined') {
			return;
		}

		sessionStorage.setItem('meeting-note-role', role);
		sessionStorage.setItem('meeting-note-employee-id', String(employeeId));
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		errorMessage = null;

		if (!form.email.trim() || !form.password) {
			errorMessage = 'Email dan password wajib diisi.';
			return;
		}

		isSubmitting = true;

		try {
			const response = await fetch('/api/login', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					email: form.email,
					password: form.password
				})
			});

			const result = (await response.json()) as {
				error?: string;
				session?: {
					role: string;
					employeeId: number;
				};
			};

			if (!response.ok) {
				throw new Error(result.error ?? 'Login gagal');
			}

			if (result.session) {
				persistSession(result.session.role, result.session.employeeId);
			}

			await goto('/list-laporan');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat login';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Login</title>
	<meta name="description" content="Login untuk mengakses form dan daftar laporan meeting." />
</svelte:head>

<div class="page-shell">
	<section class="form-card">
		<div class="hero-copy">
			<p class="eyebrow">Dinas Perencanaan Dan Pembangunan Daerah</p>
			<h1>Login Meeting Note</h1>
			<p class="lede">Masuk terlebih dahulu untuk submit dan melihat laporan meeting.</p>
		</div>

		<form class="report-form" onsubmit={handleSubmit}>
			{#if errorMessage}
				<div class="notice error" role="alert">{errorMessage}</div>
			{/if}

			<label class="field">
				<span>Email</span>
				<input
					type="email"
					bind:value={form.email}
					autocomplete="email"
					placeholder="nama@email.com"
					required
				/>
			</label>

			<label class="field">
				<span>Password</span>
				<input
					type="password"
					bind:value={form.password}
					autocomplete="current-password"
					placeholder="Masukkan password"
					required
				/>
			</label>

			<div class="actions">
				<button class="submit-button" type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Memproses...' : 'Login'}
				</button>
			</div>
		</form>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
		background:
			radial-gradient(circle at top left, rgba(255, 205, 128, 0.35), transparent 30%),
			linear-gradient(180deg, #0d2742 0%, #174c6c 50%, #f3ede2 50%, #f6f0e7 100%);
		color: #12212b;
	}

	.page-shell {
		min-height: 100vh;
		padding: 3rem 1.25rem;
		display: grid;
		align-items: center;
	}

	.form-card {
		max-width: 720px;
		width: 100%;
		margin: 0 auto;
		background: rgba(255, 250, 244, 0.96);
		border: 1px solid rgba(18, 33, 43, 0.12);
		border-radius: 28px;
		box-shadow: 0 24px 70px rgba(8, 27, 39, 0.18);
		overflow: hidden;
	}

	.hero-copy {
		padding: 2.25rem 2.25rem 1rem;
		background: linear-gradient(135deg, #14324a 0%, #0f5d78 100%);
		color: #fff8ef;
	}

	.eyebrow {
		margin: 0 0 0.4rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		font-size: 0.8rem;
		opacity: 0.78;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 3.3rem);
		line-height: 0.95;
	}

	.lede {
		max-width: 54ch;
		margin: 0.9rem 0 0;
		font-size: 1rem;
		line-height: 1.6;
	}

	.report-form {
		padding: 2rem 2.25rem 2.25rem;
		display: grid;
		gap: 1rem;
	}

	.field {
		display: grid;
		gap: 0.45rem;
		font-size: 0.98rem;
	}

	.field span {
		font-weight: 700;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #cdd9de;
		border-radius: 14px;
		padding: 0.9rem 1rem;
		font: inherit;
		background: white;
		color: inherit;
	}

	input:focus {
		outline: 2px solid rgba(193, 106, 32, 0.24);
		border-color: #c16a20;
	}

	.notice {
		padding: 1rem 1.1rem;
		border-radius: 16px;
		display: grid;
		gap: 0.25rem;
	}

	.notice.error {
		background: #fdecec;
		color: #892626;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.95rem 1.5rem;
		font: inherit;
		cursor: pointer;
		transition:
			transform 0.18s ease,
			opacity 0.18s ease,
			background 0.18s ease;
	}

	button:hover:enabled {
		transform: translateY(-1px);
	}

	button:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.submit-button {
		background: linear-gradient(135deg, #c16a20, #dd8d2a);
		color: #fff9f0;
	}

	@media (max-width: 720px) {
		.page-shell {
			padding: 1.1rem;
		}

		.hero-copy,
		.report-form {
			padding-left: 1.25rem;
			padding-right: 1.25rem;
		}
	}
</style>
