<script lang="ts">
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

	let { data } = $props<{
		data: {
			submissions: SubmissionRecord[];
			loadError: string | null;
		};
	}>();

	function formatDate(value: string): string {
		const date = new Date(value.replace(' ', 'T'));

		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return new Intl.DateTimeFormat('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}

	function formatFieldValue(value: string | string[]): string {
		return Array.isArray(value) ? value.join(', ') : value;
	}

	function toLabel(key: string): string {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, (char) => char.toUpperCase())
			.trim();
	}

	function getFieldEntries(fields: SubmissionRecord['fields']): Array<[string, string | string[]]> {
		return Object.entries(fields) as Array<[string, string | string[]]>;
	}
</script>

<svelte:head>
	<title>Daftar Laporan Meeting</title>
	<meta
		name="description"
		content="Daftar laporan meeting yang sudah disubmit melalui form submission."
	/>
</svelte:head>

<div class="page-shell">
	<section class="list-card">
		<div class="hero-copy">
			<p class="eyebrow">Dinas Perencanaan Dan Pembangunan Daerah</p>
			<h1>Daftar Laporan Meeting</h1>
			<p class="lede">
				Ringkasan semua laporan yang sudah disubmit, ditampilkan sebagai daftar yang mudah dipindai.
			</p>
		</div>

		<div class="content-panel">
			<div class="toolbar">
				<a class="ghost-link" href="/form-laporan">Buat laporan baru</a>
				<div class="count-chip">{data.submissions.length} laporan</div>
			</div>

			{#if data.loadError}
				<div class="notice error" role="alert">
					<strong>Gagal memuat data</strong>
					<span>{data.loadError}</span>
				</div>
			{:else if data.submissions.length === 0}
				<div class="empty-state">
					<h2>Belum ada laporan</h2>
					<p>Data akan muncul di sini setelah form meeting pertama berhasil disubmit.</p>
				</div>
			{:else}
				<div class="submission-list">
					{#each data.submissions as submission}
						<article class="submission-item">
							<div class="item-header">
								<div>
									<p class="item-kicker">Laporan #{submission.id}</p>
									<h2>{formatFieldValue(submission.fields.judulMeeting ?? 'Tanpa judul')}</h2>
								</div>
								<time>{formatDate(submission.submittedAt)}</time>
							</div>

							<div class="meta-grid">
								{#each getFieldEntries(submission.fields) as [key, value]}
									<div class="meta-card">
										<span>{toLabel(key)}</span>
										<strong>{formatFieldValue(value)}</strong>
									</div>
								{/each}
							</div>

							{#if submission.files.length > 0}
								<div class="attachment-group">
									<p>Attachment</p>
									<div class="attachment-list">
										{#each submission.files as file}
											<a class="attachment-link" href={file.path} target="_blank" rel="noreferrer">
												<span>{file.originalName}</span>
												<small>{Math.ceil(file.size / 1024)} KB</small>
											</a>
										{/each}
									</div>
								</div>
							{/if}
							{#if submission.pdfLink}
								<div class="attachment-group">
									<p>Laporan PDF</p>
									<div class="attachment-list">
										<a class="attachment-link" href={submission.pdfLink} target="_blank" rel="noreferrer">
											<span>Lihat PDF</span>
										</a>
									</div>
								</div>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
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

	.list-card {
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
		gap: 1.5rem;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
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

	.notice.error,
	.empty-state,
	.submission-item {
		border: 1px solid #d6dfdf;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.82);
	}

	.notice.error,
	.empty-state {
		padding: 1.2rem;
		display: grid;
		gap: 0.35rem;
	}

	.notice.error {
		color: #892626;
		background: #fdecec;
	}

	.empty-state h2,
	.submission-item h2 {
		margin: 0;
	}

	.submission-list {
		display: grid;
		gap: 1rem;
	}

	.submission-item {
		padding: 1.3rem;
		display: grid;
		gap: 1rem;
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
		flex-wrap: wrap;
	}

	.item-kicker {
		margin: 0 0 0.25rem;
		font-size: 0.82rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #8a6037;
	}

	time {
		font-size: 0.9rem;
		color: #62747d;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.8rem;
	}

	.meta-card {
		padding: 0.9rem 1rem;
		border-radius: 16px;
		background: #f4f2ed;
		display: grid;
		gap: 0.35rem;
	}

	.meta-card span,
	.attachment-group p,
	.attachment-link small {
		color: #62747d;
	}

	.meta-card span {
		font-size: 0.84rem;
	}

	.meta-card strong {
		font-size: 1rem;
		line-height: 1.4;
	}

	.attachment-group {
		display: grid;
		gap: 0.75rem;
	}

	.attachment-group p {
		margin: 0;
		font-size: 0.88rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.attachment-list {
		display: grid;
		gap: 0.65rem;
	}

	.attachment-link {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		padding: 0.9rem 1rem;
		border-radius: 16px;
		background: #e8f1f4;
		color: #17384f;
		text-decoration: none;
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

		.meta-grid {
			grid-template-columns: 1fr;
		}

		.attachment-link {
			flex-direction: column;
			align-items: start;
		}
	}
</style>