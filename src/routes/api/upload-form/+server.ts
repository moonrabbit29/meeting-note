import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';

import { createFormSubmission } from '$lib/server/form-submissions';

export const POST: RequestHandler = async ({ request }: RequestEvent) => {
  const contentType = request.headers.get('content-type') ?? '';
  const acceptsFormData =
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded');

  if (!acceptsFormData) {
    return json(
      { error: 'Expected multipart/form-data or application/x-www-form-urlencoded payload' },
      { status: 415 }
    );
  }

  try {
    const formData = await request.formData();
    const submission = await createFormSubmission(formData, 'upload-form');

    return json({ submission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to store form submission';
    const status = message.startsWith('File') || message.startsWith('Form submission') ? 400 : 500;

    return json({ error: message }, { status });
  }
};