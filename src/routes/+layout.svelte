<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	let isLoggedIn = $state(false);

	onMount(() => {
		isLoggedIn = !!sessionStorage.getItem('meeting-note-role');
	});

	async function handleLogout(): Promise<void> {
		await fetch('/api/logout', { method: 'POST' });
		sessionStorage.removeItem('meeting-note-role');
		sessionStorage.removeItem('meeting-note-employee-id');
		isLoggedIn = false;
		await goto('/login');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

{#if isLoggedIn && $page.url.pathname !== '/login'}
	<button class="logout-fab" type="button" onclick={handleLogout}>Logout</button>
{/if}

<style>
	.logout-fab {
		position: fixed;
		top: 1.25rem;
		right: 1.25rem;
		z-index: 100;
		border: 1px solid rgba(18, 33, 43, 0.2);
		border-radius: 999px;
		padding: 0.5rem 1.1rem;
		font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
		font-size: 0.88rem;
		cursor: pointer;
		background: rgba(255, 250, 244, 0.92);
		color: #14324a;
		box-shadow: 0 4px 16px rgba(8, 27, 39, 0.12);
		backdrop-filter: blur(6px);
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}

	.logout-fab:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 22px rgba(8, 27, 39, 0.18);
	}
</style>
