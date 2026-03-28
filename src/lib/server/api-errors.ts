import { AuthApiError } from '$lib/server/auth';

type ApiErrorRule = {
	status: number;
	clientMessage: string;
	test: (message: string) => boolean;
};

type MappedApiError = {
	status: number;
	message: string;
};

function getErrorDetails(error: unknown): { name: string; message: string; stack?: string } {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack
		};
	}

	return {
		name: 'UnknownError',
		message: String(error)
	};
}

export function mapApiError(
	error: unknown,
	fallbackMessage: string,
	rules: ApiErrorRule[] = []
): MappedApiError {
	if (error instanceof AuthApiError) {
		return { status: error.status, message: error.message };
	}

	const details = getErrorDetails(error);

	for (const rule of rules) {
		if (rule.test(details.message)) {
			return {
				status: rule.status,
				message: rule.clientMessage
			};
		}
	}

	return {
		status: 500,
		message: fallbackMessage
	};
}

export function logApiError(context: string, error: unknown, meta: Record<string, unknown> = {}): void {
	const details = getErrorDetails(error);

	console.error('[api-error]', {
		context,
		...meta,
		errorName: details.name,
		errorMessage: details.message,
		errorStack: details.stack
	});
}