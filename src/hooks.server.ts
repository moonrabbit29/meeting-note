import { json, redirect, type Handle } from '@sveltejs/kit';

import { clearAuthCookie, readAuthenticatedAccount } from '$lib/server/auth';

const PUBLIC_EXACT_PATHS = new Set(['/', '/login']);
const PUBLIC_API_PATHS = new Set(['/api/login', '/api/accounts/owner']);

function isApiRequest(pathname: string): boolean {
	return pathname.startsWith('/api/');
}

function isProtectedPath(pathname: string): boolean {
	if (PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
		return false;
	}

	if (
		pathname.startsWith('/form-laporan') ||
		pathname.startsWith('/list-laporan') ||
		pathname.startsWith('/accounts')
	) {
		return true;
	}

	return isApiRequest(pathname);
}

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	const account = await readAuthenticatedAccount(event.request);

	event.locals.account = account;

	if (!isProtectedPath(pathname)) {
		return resolve(event);
	}

	if (account) {
		return resolve(event);
	}

	clearAuthCookie(event.cookies);

	if (isApiRequest(pathname)) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	throw redirect(303, '/login');
};