<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Calendar, DayGrid, List, Interaction } from '@event-calendar/core';
	import '@event-calendar/core/index.css';

	import { getCalendarEventUi, type CalendarEventDomainModel } from '$lib/calendar/event-state';

	type ReportSummary = {
		id: number;
		submittedAt: string;
		fields: Record<string, string | string[]>;
		pdfLink: string | null;
	};

	type CalendarEventRow = {
		id: number;
		title: string;
		startTime: string;
		endTime: string;
		formSubmissionId: number | null;
		isCancelled: boolean;
		reportSummary: ReportSummary | null;
	};

	let { data } = $props<{
		data: {
			events: CalendarEventRow[];
			loadError: string | null;
		};
	}>();

	let editingEvent = $state<CalendarEventRow | null>(null);
	let viewingReportEvent = $state<CalendarEventRow | null>(null);
	let planningMode = $state(false);

	const now = $derived(new Date());

	const calendarEvents = $derived(
		data.events.map((event: CalendarEventRow) => {
			const ui = getCalendarEventUi(event as CalendarEventDomainModel, now);

			return {
				id: String(event.id),
				title: event.title,
				start: event.startTime,
				end: event.endTime,
				classNames: ui.classNames,
				extendedProps: {
					rawEvent: event,
					ui
				}
			};
		})
	);

	const options = $derived({
		view: 'dayGridMonth',
		headerToolbar: {
			start: 'prev,next today',
			center: 'title',
			end: 'dayGridMonth,listWeek'
		},
		buttonText: {
			today: 'Hari ini',
			dayGridMonth: 'Bulan',
			listWeek: 'Agenda'
		},
		events: calendarEvents,
		eventClick(info: any) {
			const selected = info.event.extendedProps.rawEvent as CalendarEventRow;
			const action = info.event.extendedProps.ui.clickAction as ReturnType<
				typeof getCalendarEventUi
			>['clickAction'];

			if (action.type === 'open-edit-modal') {
				planningMode = false;
				viewingReportEvent = null;
				editingEvent = selected;
				return;
			}

			if (action.type === 'redirect') {
				void goto(action.href);
				return;
			}

			if (action.type === 'open-report-view') {
				planningMode = false;
				editingEvent = null;
				viewingReportEvent = selected;
			}
		}
	});

		const isSidebarOpen = $derived(planningMode || editingEvent !== null || viewingReportEvent !== null);

	function readField(fields: Record<string, string | string[]>, key: string): string {
		const value = fields[key];

		if (Array.isArray(value)) {
			return value.join(', ');
		}

		return value ?? '-';
	}

	function readFieldHtml(fields: Record<string, string | string[]>, key: string): string {
		const value = readField(fields, key);

		if (value === '-') {
			return '<p>-</p>';
		}

		return value;
	}

	function formatDisplayDate(value: string): string {
		const parsed = new Date(value);

		if (Number.isNaN(parsed.getTime())) {
			return value || '-';
		}

		return parsed.toLocaleDateString('id-ID', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	async function onSuccessAndRefresh(): Promise<void> {
		planningMode = false;
		editingEvent = null;
		viewingReportEvent = null;
		await invalidateAll();
	}

	function closeSidebar(): void {
		planningMode = false;
		editingEvent = null;
		viewingReportEvent = null;
	}

	function openPlanningSidebar(): void {
		planningMode = true;
		editingEvent = null;
		viewingReportEvent = null;
	}
</script>

<svelte:head>
	<title>Meeting Calendar</title>
	<meta
		name="description"
		content="Meeting Calendar dengan status planned, action required, completed, dan cancelled."
	/>
</svelte:head>

<div class="page-shell">
	<section class="calendar-card">
		<header class="header">
			<div>
				<p class="eyebrow">Meeting Calendar</p>
				<h1>Meeting Scheduler</h1>
			</div>
			<button class="primary" type="button" onclick={openPlanningSidebar}>Plan Meeting</button>
		</header>

		<div class="calendar-layout" class:with-sidebar={isSidebarOpen}>
			<div>
				{#if data.loadError}
					<p class="notice error">{data.loadError}</p>
				{:else}
					<div class="calendar-wrap">
						<Calendar plugins={[DayGrid, List, Interaction]} {options} />
					</div>
				{/if}

				<div class="legend">
					<span class="chip planned">Planned</span>
					<span class="chip action-required">Action Required</span>
					<span class="chip completed">Completed</span>
					<span class="chip cancelled">Cancelled</span>
				</div>
			</div>

			{#if planningMode || editingEvent || viewingReportEvent}
				<aside class="sidebar" aria-live="polite">
					<div class="sidebar-header">
						<h2>{planningMode ? 'Plan Meeting' : editingEvent ? 'Edit Details' : 'Meeting Terpilih'}</h2>
						<button class="ghost" type="button" onclick={closeSidebar}>Close</button>
					</div>

					{#if planningMode}
						<form
							method="POST"
							action="?/createPlannedEvent"
							use:enhance={() => {
								return async ({ result }) => {
									if (result.type === 'success') {
										await onSuccessAndRefresh();
									}
								};
							}}
						>
							<label>Title<input name="title" required /></label>
							<label>
								Start Time
								<input name="startTime" type="datetime-local" required />
							</label>
							<label>
								End Time
								<input name="endTime" type="datetime-local" required />
							</label>
							<div class="sidebar-actions">
								<button class="primary" type="submit">Create Planned Meeting</button>
							</div>
						</form>
					{:else if editingEvent}
						<p class="sidebar-title">{editingEvent.title}</p>
						<form
							method="POST"
							action="?/updatePlannedEvent"
							use:enhance={() => {
								return async ({ result }) => {
									if (result.type === 'success') {
										await onSuccessAndRefresh();
									}
								};
							}}
						>
							<input type="hidden" name="eventId" value={editingEvent.id} />
							<label>Title<input name="title" required value={editingEvent.title} /></label>
							<label>
								Start Time
								<input
									name="startTime"
									type="datetime-local"
									required
									value={editingEvent.startTime.slice(0, 16)}
								/>
							</label>
							<label>
								End Time
								<input
									name="endTime"
									type="datetime-local"
									required
									value={editingEvent.endTime.slice(0, 16)}
								/>
							</label>
							<div class="sidebar-actions">
								<button class="primary" type="submit">Save Changes</button>
							</div>
						</form>

						<form
							method="POST"
							action="?/cancelEvent"
							use:enhance={() => {
								return async ({ result }) => {
									if (result.type === 'success') {
										await onSuccessAndRefresh();
									}
								};
							}}
						>
							<input type="hidden" name="eventId" value={editingEvent.id} />
							<button type="submit" class="danger">Mark as Cancelled</button>
						</form>
					{:else if viewingReportEvent}
						{#if viewingReportEvent.reportSummary}
							<p class="sidebar-kicker">Meeting Terpilih</p>
							<p class="sidebar-title">{viewingReportEvent.title}</p>

							<div class="summary-grid">
								<section class="info-card">
									<p class="info-label">Tanggal</p>
									<div class="info-value">
										{formatDisplayDate(readField(viewingReportEvent.reportSummary.fields, 'tanggalMeeting'))}
									</div>
								</section>

								<section class="info-card">
									<p class="info-label">Pegawai</p>
									<div class="info-value">
										{readField(viewingReportEvent.reportSummary.fields, 'namaPegawai')}
									</div>
								</section>

								<section class="info-card">
									<p class="info-label">Status</p>
									<div class="info-value">
										{readField(viewingReportEvent.reportSummary.fields, 'melaksanakanMeeting')}
									</div>
								</section>

								<section class="info-card">
									<p class="info-label">Ringkasan</p>
									<div class="info-value rich-value">
										{@html readFieldHtml(viewingReportEvent.reportSummary.fields, 'deskripsiMeeting')}
									</div>
								</section>
							</div>

								{#if viewingReportEvent.reportSummary.pdfLink}
									<a
										class="pdf-link"
										href={viewingReportEvent.reportSummary.pdfLink}
										target="_blank"
										rel="noreferrer"
										>View PDF</a
									>
								{/if}
						{:else}
							<p>Report details are unavailable.</p>
						{/if}
					{/if}
				</aside>
			{/if}
		</div>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
		background: linear-gradient(180deg, #f9f3e8 0%, #f4f7fb 100%);
	}

	.page-shell {
		padding: 1rem;
	}

	.calendar-card {
		max-width: 1200px;
		margin: 0 auto;
		background: #fffdf9;
		border-radius: 20px;
		padding: 1rem;
		border: 1px solid #e3dfd2;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-size: 0.75rem;
		color: #6c6c6c;
	}

	h1 {
		margin: 0.2rem 0 0;
		font-size: clamp(1.5rem, 3vw, 2.2rem);
	}

	.calendar-wrap {
		margin-top: 1rem;
	}

	.calendar-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}

	.calendar-layout.with-sidebar {
		grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
		align-items: start;
	}

	.notice.error {
		background: #fff1ed;
		border: 1px solid #f1beb2;
		padding: 0.75rem;
		border-radius: 12px;
	}

	.legend {
		margin-top: 0.8rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.chip {
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		font-size: 0.82rem;
	}

	.chip.planned {
		border: 1px dashed #8a8f98;
		background: #01ffff;
	}

	.chip.action-required {
		background: #fff3cd;
		color: #8a5a00;
	}

	.chip.completed {
		background: #d1fae5;
		color: #065f46;
	}

	.chip.cancelled {
		background: #9ca3af;
		color: black;
		text-decoration: line-through;
	}

	:global(.event-planned) {
		border: 1px dashed #8b8f97 !important;
		background: #01ffff !important;
		color: #38414f !important;
	}

	:global(.event-action-required) {
		background: #ffd27d !important;
		color: #4e3000 !important;
	}

	:global(.event-completed) {
		background: #22a06b !important;
		color: #ffffff !important;
	}

	:global(.event-cancelled) {
		background: #9ca3af !important;
		color: black !important;
	}

	:global(.event-strikethrough .ec-event-title) {
		text-decoration: line-through;
	}

	.primary,
	.ghost,
	.danger {
		padding: 0.6rem 0.95rem;
		border-radius: 999px;
		border: none;
		cursor: pointer;
		font: inherit;
	}

	.primary {
		background: #1d4ed8;
		color: #fff;
	}

	.ghost {
		background: #eef2ff;
		color: #1e3a8a;
	}

	.danger {
		background: #b91c1c;
		color: #fff;
		margin-top: 0.7rem;
	}

	.sidebar {
		position: sticky;
		top: 1rem;
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 22px;
		padding: 1.25rem;
		box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.95rem;
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 1rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #2f7086;
	}

	.sidebar-kicker {
		margin: 0 0 0.25rem;
		font-size: 0.98rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #2f7086;
	}

	.sidebar-title {
		margin: 0 0 1rem;
		font-size: clamp(1.8rem, 2.2vw, 2.2rem);
		font-weight: 700;
		color: #18344d;
	}

	label {
		display: grid;
		gap: 0.3rem;
		margin: 0.45rem 0;
	}

	input {
		font: inherit;
		border: 1px solid #d1d5db;
		border-radius: 10px;
		padding: 0.55rem;
	}

	.sidebar-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-start;
		margin-top: 0.8rem;
	}

	.summary-grid {
		display: grid;
		gap: 0.75rem;
	}

	.info-card {
		display: grid;
		gap: 0.35rem;
	}

	.info-label {
		margin: 0;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7f8f;
		font-weight: 700;
	}

	.info-value {
		background: #efe9e2;
		border-radius: 18px;
		padding: 0.9rem 1rem;
		font-size: 1.05rem;
		line-height: 1.5;
		font-weight: 600;
		color: #1f3f55;
		word-break: break-word;
	}

	.rich-value {
		font-weight: 500;
	}

	.rich-value :global(p),
	.rich-value :global(ul),
	.rich-value :global(ol) {
		margin: 0;
	}

	.rich-value :global(ul),
	.rich-value :global(ol) {
		padding-left: 1.2rem;
	}

	.pdf-link {
		display: inline-flex;
		margin-top: 0.9rem;
		padding: 0.55rem 0.9rem;
		border-radius: 999px;
		background: #1d4ed8;
		color: #fff;
		text-decoration: none;
		font-weight: 600;
	}

	@media (max-width: 1080px) {
		.calendar-layout.with-sidebar {
			grid-template-columns: minmax(0, 1fr);
		}

		.sidebar {
			position: static;
		}
	}
</style>
