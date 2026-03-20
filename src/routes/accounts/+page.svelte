<script lang="ts">
	import { onMount } from 'svelte';

	type Account = {
		id: number;
		email: string;
		name: string;
		role: string;
		isOwner: boolean;
		isActive: boolean;
		createdAt: string;
		updatedAt: string;
	};

	type RegisterForm = {
		name: string;
		email: string;
		password: string;
		role: 'SystemAdministrator' | 'employee';
	};

	let accounts = $state<Account[]>([]);
	let loadError = $state<string | null>(null);
	let isLoading = $state(true);

	let form = $state<RegisterForm>({
		name: '',
		email: '',
		password: '',
		role: 'employee'
	});
	let formError = $state<string | null>(null);
	let formSuccess = $state<string | null>(null);
	let isSubmitting = $state(false);

	let toggleError = $state<string | null>(null);

	async function loadAccounts(): Promise<void> {
		isLoading = true;
		loadError = null;

		try {
			const response = await fetch('/api/accounts');
			const result = (await response.json()) as { accounts?: Account[]; error?: string };

			if (!response.ok) {
				throw new Error(result.error ?? 'Gagal memuat daftar akun');
			}

			accounts = result.accounts ?? [];
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Terjadi kesalahan';
		} finally {
			isLoading = false;
		}
	}

	async function handleRegister(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		formError = null;
		formSuccess = null;
		isSubmitting = true;

		try {
			const response = await fetch('/api/signup', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: form.name,
					email: form.email,
					password: form.password,
					role: form.role
				})
			});

			const result = (await response.json()) as { account?: Account; error?: string };

			if (!response.ok) {
				throw new Error(result.error ?? 'Gagal membuat akun');
			}

			formSuccess = `Akun untuk ${result.account?.name} berhasil dibuat.`;
			form = { name: '', email: '', password: '', role: 'employee' };
			await loadAccounts();
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Terjadi kesalahan';
		} finally {
			isSubmitting = false;
		}
	}

	async function toggleActive(account: Account): Promise<void> {
		toggleError = null;

		try {
			const response = await fetch(`/api/accounts/${account.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ isActive: !account.isActive })
			});

			const result = (await response.json()) as { account?: Account; error?: string };

			if (!response.ok) {
				throw new Error(result.error ?? 'Gagal mengubah status akun');
			}

			accounts = accounts.map((a) => (a.id === account.id ? (result.account ?? a) : a));
		} catch (error) {
			toggleError = error instanceof Error ? error.message : 'Terjadi kesalahan';
		}
	}

	function formatDate(value: string): string {
		const date = new Date(value.replace(' ', 'T'));

		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return new Intl.DateTimeFormat('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		}).format(date);
	}

	onMount(loadAccounts);
</script>

<svelte:head>
	<title>Manajemen Akun</title>
	<meta name="description" content="Kelola akun pengguna aplikasi Meeting Note." />
</svelte:head>

<div class="page-shell">
	<section class="main-card">
		<div class="hero-copy">
			<p class="eyebrow">Dinas Perencanaan Dan Pembangunan Daerah</p>
			<h1>Manajemen Akun</h1>
			<p class="lede">Daftar semua akun pengguna dan form pendaftaran akun baru.</p>
		</div>

		<div class="content-panel">
			<div class="toolbar">
				<div class="toolbar-actions">
					<a class="ghost-link" href="/list-laporan">Daftar laporan</a>
					<a class="ghost-link" href="/form-laporan">Buat laporan</a>
				</div>
				<div class="count-chip">{accounts.length} akun</div>
			</div>

			<!-- Account list -->
			<section class="section-block">
				<h2 class="section-title">Daftar Akun</h2>

				{#if isLoading}
					<div class="notice info" role="status">Memuat daftar akun…</div>
				{:else if loadError}
					<div class="notice error" role="alert">
						<strong>Gagal memuat</strong>
						<span>{loadError}</span>
					</div>
				{:else if accounts.length === 0}
					<div class="empty-state">
						<p>Belum ada akun terdaftar.</p>
					</div>
				{:else}
					{#if toggleError}
						<div class="notice error" role="alert">{toggleError}</div>
					{/if}

					<div class="account-list">
						{#each accounts as account}
							<div class="account-item" class:inactive={!account.isActive}>
								<div class="account-info">
									<div class="account-name-row">
										<strong>{account.name}</strong>
										{#if account.isOwner}
											<span class="badge owner">Owner</span>
										{/if}
										<span class="badge role">{account.role}</span>
										<span class="badge status" class:active={account.isActive}>
											{account.isActive ? 'Aktif' : 'Nonaktif'}
										</span>
									</div>
									<span class="account-email">{account.email}</span>
									<span class="account-date">Terdaftar {formatDate(account.createdAt)}</span>
								</div>

								{#if !account.isOwner}
									<button
										class="toggle-btn"
										class:deactivate={account.isActive}
										type="button"
										onclick={() => toggleActive(account)}
									>
										{account.isActive ? 'Nonaktifkan' : 'Aktifkan'}
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Register form -->
			<section class="section-block">
				<h2 class="section-title">Daftarkan Akun Baru</h2>

				<form class="register-form" onsubmit={handleRegister}>
					{#if formError}
						<div class="notice error" role="alert">{formError}</div>
					{/if}
					{#if formSuccess}
						<div class="notice success" role="status">{formSuccess}</div>
					{/if}

					<div class="field-grid">
						<label class="field">
							<span>Nama Lengkap</span>
							<input
								type="text"
								bind:value={form.name}
								placeholder="Contoh: Budi Santoso"
								required
							/>
						</label>

						<label class="field">
							<span>Email</span>
							<input
								type="email"
								bind:value={form.email}
								placeholder="nama@email.com"
								required
							/>
						</label>

						<label class="field">
							<span>Password</span>
							<input
								type="password"
								bind:value={form.password}
								placeholder="Minimal 8 karakter"
								required
							/>
						</label>

						<label class="field">
							<span>Role</span>
							<select bind:value={form.role}>
								<option value="employee">Employee</option>
								<option value="SystemAdministrator">System Administrator</option>
							</select>
						</label>
					</div>

					<div class="actions">
						<button class="submit-btn" type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Menyimpan…' : 'Daftarkan Akun'}
						</button>
					</div>
				</form>
			</section>
		</div>
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
	}

	.main-card {
		max-width: 1100px;
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
		font-size: clamp(2rem, 4vw, 3.6rem);
		line-height: 0.95;
	}

	.lede {
		max-width: 60ch;
		margin: 0.9rem 0 0;
		font-size: 1rem;
		line-height: 1.6;
	}

	.content-panel {
		padding: 2rem 2.25rem 2.25rem;
		display: grid;
		gap: 2rem;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.toolbar-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.ghost-link,
	.count-chip {
		border-radius: 999px;
		padding: 0.75rem 1rem;
		font-size: 0.95rem;
	}

	.ghost-link {
		text-decoration: none;
		background: #e7edf0;
		color: #17384f;
	}

	.count-chip {
		background: #f4e6d4;
		color: #7c4a19;
	}

	.section-block {
		display: grid;
		gap: 1rem;
	}

	.section-title {
		margin: 0;
		font-size: 1.3rem;
		color: #14324a;
	}

	/* Notices */
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

	.notice.info {
		background: #e9f3fa;
		color: #144f6d;
	}

	.notice.success {
		background: #eaf6ee;
		color: #1a5c2e;
	}

	/* Account list */
	.account-list {
		display: grid;
		gap: 0.75rem;
	}

	.account-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border: 1px solid #d6dfdf;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.82);
		flex-wrap: wrap;
	}

	.account-item.inactive {
		opacity: 0.6;
	}

	.account-info {
		display: grid;
		gap: 0.25rem;
	}

	.account-name-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.account-email {
		font-size: 0.9rem;
		color: #62747d;
	}

	.account-date {
		font-size: 0.82rem;
		color: #8a9ba4;
	}

	.badge {
		font-size: 0.75rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.badge.owner {
		background: #f4e6d4;
		color: #7c4a19;
	}

	.badge.role {
		background: #e2eaf0;
		color: #17384f;
	}

	.badge.status {
		background: #fce8e8;
		color: #892626;
	}

	.badge.status.active {
		background: #eaf6ee;
		color: #1a5c2e;
	}

	.empty-state {
		padding: 1.5rem;
		border: 1px solid #d6dfdf;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.82);
		color: #62747d;
	}

	.empty-state p {
		margin: 0;
	}

	/* Toggle button */
	.toggle-btn {
		border: 0;
		border-radius: 999px;
		padding: 0.6rem 1.1rem;
		font: inherit;
		font-size: 0.88rem;
		cursor: pointer;
		background: #eaf6ee;
		color: #1a5c2e;
		transition:
			transform 0.18s ease,
			opacity 0.18s ease;
		white-space: nowrap;
	}

	.toggle-btn.deactivate {
		background: #fce8e8;
		color: #892626;
	}

	.toggle-btn:hover {
		transform: translateY(-1px);
	}

	/* Register form */
	.register-form {
		display: grid;
		gap: 1rem;
		padding: 1.5rem;
		border: 1px solid #d6dfdf;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.82);
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

	input,
	select {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #cdd9de;
		border-radius: 14px;
		padding: 0.9rem 1rem;
		font: inherit;
		background: white;
		color: inherit;
	}

	input:focus,
	select:focus {
		outline: 2px solid rgba(193, 106, 32, 0.24);
		border-color: #c16a20;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	.submit-btn {
		border: 0;
		border-radius: 999px;
		padding: 0.95rem 1.5rem;
		font: inherit;
		cursor: pointer;
		background: linear-gradient(135deg, #c16a20, #dd8d2a);
		color: #fff9f0;
		transition:
			transform 0.18s ease,
			opacity 0.18s ease;
	}

	.submit-btn:hover:enabled {
		transform: translateY(-1px);
	}

	.submit-btn:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	@media (max-width: 720px) {
		.page-shell {
			padding: 1.1rem;
		}

		.hero-copy,
		.content-panel {
			padding-left: 1.25rem;
			padding-right: 1.25rem;
		}

		.account-item {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
