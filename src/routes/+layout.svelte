<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	let isLoggedIn = $state(false);
	const navItems = [
		{ href: '/calendar', label: 'Kalender' },
		{ href: '/list-laporan', label: 'Daftar Laporan' },
		{ href: '/form-laporan', label: 'Form Laporan' },
		{ href: '/accounts', label: 'Akun' }
	] as const;

	function refreshAuthState(): void {
		isLoggedIn = !!sessionStorage.getItem('meeting-note-role');
	}

	onMount(() => {
		refreshAuthState();
	});

	afterNavigate(() => {
		refreshAuthState();
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

{#if isLoggedIn && $page.url.pathname !== '/login'}
	<div class="top-actions">
		<nav class="nav-fab" aria-label="Navigasi utama">
			{#each navItems as item}
				<a
					class="nav-link"
					class:active={$page.url.pathname.startsWith(item.href)}
					href={item.href}
				>
					{item.label}
				</a>
			{/each}
		</nav>
		<button class="logout-fab" type="button" onclick={handleLogout}>Logout</button>
	</div>
{/if}

{@render children()}

<style>
	.top-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.8rem;
		padding: 1.25rem;
		margin-bottom: 5%;
	}

	.nav-fab {
		display: flex;
		gap: 0.45rem;
		padding: 0.35rem;
		border: 1px solid rgba(18, 33, 43, 0.2);
		border-radius: 999px;
		background: rgba(255, 250, 244, 0.92);
		box-shadow: 0 4px 16px rgba(8, 27, 39, 0.12);
		backdrop-filter: blur(6px);
	}

	.nav-link {
		text-decoration: none;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
		font-size: 0.88rem;
		color: #14324a;
		transition: background 0.18s ease;
	}

	.nav-link:hover {
		background: rgba(20, 50, 74, 0.08);
	}

	.nav-link.active {
		background: linear-gradient(135deg, #14324a, #0f5d78);
		color: #fff8ef;
	}

	.logout-fab {
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

	@media (max-width: 720px) {
		.top-actions {
			padding: 0.7rem;
			gap: 0.55rem;
		}

		.nav-fab {
			overflow-x: auto;
			white-space: nowrap;
		}
	}
</style>
