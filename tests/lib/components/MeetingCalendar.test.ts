// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructorSpy = vi.fn();
const renderSpy = vi.fn();
const destroySpy = vi.fn();
const removeAllEventsSpy = vi.fn();
const addEventSourceSpy = vi.fn();
const batchRenderingSpy = vi.fn((callback: () => void) => callback());

vi.mock('@fullcalendar/core', () => {
	class MockCalendar {
		constructor(node: HTMLElement, options: unknown) {
			constructorSpy(node, options);
		}

		render() {
			renderSpy();
		}

		destroy() {
			destroySpy();
		}

		removeAllEvents() {
			removeAllEventsSpy();
		}

		addEventSource(events: unknown) {
			addEventSourceSpy(events);
		}

		batchRendering(callback: () => void) {
			batchRenderingSpy(callback);
		}
	}

	return {
		Calendar: MockCalendar
	};
});

vi.mock('@fullcalendar/daygrid', () => ({ default: { name: 'dayGrid' } }));
vi.mock('@fullcalendar/interaction', () => ({ default: { name: 'interaction' } }));
vi.mock('@fullcalendar/list', () => ({ default: { name: 'list' } }));
vi.mock('@fullcalendar/core/locales/id', () => ({ default: { code: 'id' } }));

describe('MeetingCalendar component', () => {
	afterEach(() => {
		cleanup();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates a FullCalendar instance and passes mapped events into its options', async () => {
		const MeetingCalendar = (await import('../../../src/lib/components/MeetingCalendar.svelte')).default;
		const onEventSelect = vi.fn();
		const events = [
			{
				id: '12',
				title: 'Rapat Koordinasi',
				start: '2026-04-18',
				allDay: true,
				backgroundColor: '#0f766e',
				borderColor: '#115e59',
				textColor: '#fff8ef',
				extendedProps: {
					submissionId: 12,
					employeeName: 'Dendi',
					executionStatus: 'Ya' as const,
					meetingDate: '2026-04-18',
					description: 'Sinkronisasi agenda',
					pdfLink: null
				}
			}
		];

		render(MeetingCalendar, {
			props: {
				events,
				onEventSelect
			}
		});

		expect(screen.getByTestId('meeting-calendar')).toBeTruthy();

		await waitFor(() => {
			expect(renderSpy).toHaveBeenCalledTimes(1);
		});

		expect(constructorSpy).toHaveBeenCalledTimes(1);

		const [, options] = constructorSpy.mock.calls[0] as [HTMLElement, {
			events: typeof events;
			initialView: string;
			eventClick: (info: {
				jsEvent: { preventDefault: () => void };
				event: {
					id: string;
					title: string;
					startStr: string;
					allDay: boolean;
					backgroundColor: string;
					borderColor: string;
					textColor: string;
					extendedProps: typeof events[number]['extendedProps'];
				};
			}) => void;
		}];

		expect(options.initialView).toBe('dayGridMonth');
		expect(options.events).toEqual(events);

		const preventDefault = vi.fn();
		options.eventClick({
			jsEvent: { preventDefault },
			event: {
				id: '12',
				title: 'Rapat Koordinasi',
				startStr: '2026-04-18',
				allDay: true,
				backgroundColor: '#0f766e',
				borderColor: '#115e59',
				textColor: '#fff8ef',
				extendedProps: events[0].extendedProps
			}
		});

		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(onEventSelect).toHaveBeenCalledWith(events[0]);
	});
});