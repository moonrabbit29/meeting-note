<script lang="ts">
	import { onMount } from 'svelte';
	import { Calendar, type CalendarOptions } from '@fullcalendar/core';
	import dayGridPlugin from '@fullcalendar/daygrid';
	import interactionPlugin from '@fullcalendar/interaction';
	import listPlugin from '@fullcalendar/list';
	import idLocale from '@fullcalendar/core/locales/id';
	import type { MeetingNoteCalendarEvent } from '$lib/types/meeting-calendar';

	let { events, onEventSelect } = $props<{
		events: MeetingNoteCalendarEvent[];
		onEventSelect?: (event: MeetingNoteCalendarEvent) => void;
	}>();

	let container = $state<HTMLDivElement | null>(null);
	let calendar = $state<Calendar | null>(null);

	function getCalendarOptions(currentEvents: MeetingNoteCalendarEvent[]): CalendarOptions {
		return {
			plugins: [dayGridPlugin, interactionPlugin, listPlugin],
			locale: idLocale,
			initialView: 'dayGridMonth',
			height: 'auto',
			fixedWeekCount: false,
			dayMaxEvents: 2,
			headerToolbar: {
				left: 'prev,next today',
				center: 'title',
				right: 'dayGridMonth,listWeek'
			},
			buttonText: {
				today: 'Hari ini',
				month: 'Bulan',
				week: 'Minggu',
				list: 'Agenda'
			},
			events: currentEvents,
			eventClick: (info) => {
				info.jsEvent.preventDefault();

				onEventSelect?.({
					id: info.event.id,
					title: info.event.title,
					start: info.event.startStr.slice(0, 10),
					allDay: info.event.allDay,
					backgroundColor: info.event.backgroundColor,
					borderColor: info.event.borderColor,
					textColor: info.event.textColor,
					extendedProps: info.event.extendedProps as MeetingNoteCalendarEvent['extendedProps']
				});
			}
		};
	}

	onMount(() => {
		if (!container) {
			return;
		}

		calendar = new Calendar(container, getCalendarOptions(events));
		calendar.render();

		return () => {
			calendar?.destroy();
			calendar = null;
		};
	});

	$effect(() => {
		const currentEvents = events;

		if (!calendar) {
			return;
		}

		calendar.batchRendering(() => {
			calendar?.removeAllEvents();
			calendar?.addEventSource(currentEvents);
		});
	});
</script>

<div bind:this={container} class="calendar-root" data-testid="meeting-calendar"></div>

<style>
	.calendar-root {
		min-height: 42rem;
	}

	:global(.fc) {
		font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
		color: #14324a;
	}

	:global(.fc .fc-toolbar-title) {
		font-size: clamp(1.35rem, 2vw, 1.9rem);
		font-weight: 700;
	}

	:global(.fc .fc-button-primary) {
		border: 0;
		background: linear-gradient(135deg, #14324a, #0f5d78);
		color: #fff8ef;
		box-shadow: 0 8px 20px rgba(20, 50, 74, 0.18);
	}

	:global(.fc .fc-button-primary:hover),
	:global(.fc .fc-button-primary:focus),
	:global(.fc .fc-button-primary:not(:disabled).fc-button-active) {
		background: linear-gradient(135deg, #0f5d78, #14324a);
	}

	:global(.fc .fc-daygrid-day-frame) {
		background: rgba(255, 250, 244, 0.72);
	}

	:global(.fc .fc-day-today) {
		background: rgba(240, 195, 48, 0.18) !important;
	}

	:global(.fc .fc-event) {
		border-radius: 999px;
		padding: 0.18rem 0.45rem;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}

	:global(.fc .fc-list-event:hover td) {
		background: rgba(20, 50, 74, 0.06);
	}
</style>