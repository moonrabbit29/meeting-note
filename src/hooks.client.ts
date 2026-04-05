import { goto } from '$app/navigation';

// Intercept fetch to handle 401 responses (expired/invalid auth)
const originalFetch = globalThis.fetch;

globalThis.fetch = async (
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> => {
	const response = await originalFetch(input, init);

	// If we get a 401 from any API endpoint, clear session and redirect to login
	if (response.status === 401) {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

		// Only handle API calls (not login/logout endpoints)
		if (url?.includes('/api/') && !url.includes('/api/login')) {
			// Clear client-side auth data
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.removeItem('meeting-note-role');
				sessionStorage.removeItem('meeting-note-employee-id');
			}

			// Redirect to login
			await goto('/login');
		}
	}

	return response;
};
