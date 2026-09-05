export type DemoActionState = 'idle' | 'loading' | 'success' | 'error'

export interface DemoErrorDetails {
	message: string
	code?: string
	details?: string
	hint?: string
}

export function describeDemoError(cause: unknown): DemoErrorDetails {
	if (cause && typeof cause === 'object') {
		const value = cause as Record<string, unknown>
		return {
			message: typeof value.message === 'string' ? value.message : String(cause),
			code: typeof value.code === 'string' ? value.code : undefined,
			details: typeof value.details === 'string' && value.details !== value.message ? value.details : undefined,
			hint: typeof value.hint === 'string' ? value.hint : undefined,
		}
	}
	return { message: cause instanceof Error ? cause.message : String(cause) }
}

export function useDemoAction() {
	const state = ref<DemoActionState>('idle')
	const label = ref('')
	const error = ref<DemoErrorDetails | null>(null)

	function loading(message: string) {
		state.value = 'loading'
		label.value = message
		error.value = null
	}

	function success(message: string) {
		state.value = 'success'
		label.value = message
		error.value = null
	}

	function fail(cause: unknown, prefix = 'Action failed') {
		state.value = 'error'
		label.value = prefix
		error.value = describeDemoError(cause)
	}

	function reset() {
		state.value = 'idle'
		label.value = ''
		error.value = null
	}

	return { state, label, error, loading, success, fail, reset }
}
