import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.account) {
		throw redirect(303, '/calendar');
	}

	return {};
};