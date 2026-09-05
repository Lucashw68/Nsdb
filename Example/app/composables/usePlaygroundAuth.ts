const playgroundAccounts = {
	alice: { email: 'alice+playground@example.test', password: 'NSDB-playground-alice' },
	bob: { email: 'bob+playground@example.test', password: 'NSDB-playground-bob' },
} as const

export function usePlaygroundAuth() {
	const supabase = useSupabaseClient()
	const user = useSupabaseUser()
	const busy = useState('playground-auth-busy', () => false)
	const error = useState('playground-auth-error', () => '')

	async function useLocalAccount(name: keyof typeof playgroundAccounts) {
		busy.value = true
		error.value = ''
		const credentials = playgroundAccounts[name]
		try {
			const login = await supabase.auth.signInWithPassword(credentials)
			if (!login.error && login.data.user) {
				user.value = login.data.user
				return
			}

			const signup = await supabase.auth.signUp(credentials)
			if (signup.error) throw signup.error
			if (!signup.data.user || !signup.data.session) {
				throw new Error('The local demo account could not be created. Run `yarn supabase:reset` and retry.')
			}
			user.value = signup.data.user
		} catch (cause: unknown) {
			error.value = cause instanceof Error ? cause.message : String(cause)
		} finally {
			busy.value = false
		}
	}

	async function logout() {
		busy.value = true
		error.value = ''
		try {
			const result = await supabase.auth.signOut()
			if (result.error) throw result.error
			user.value = null
		} catch (cause: unknown) {
			error.value = cause instanceof Error ? cause.message : String(cause)
		} finally {
			busy.value = false
		}
	}

	return { user, busy, error, useLocalAccount, logout }
}
