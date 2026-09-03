import { defineStore } from 'pinia'
import { ref } from 'vue'

let supabaseClient: any = null
export const testSupabaseUser = ref<{ id: string } | null>(null)

export function setTestSupabaseClient(client: any) {
	supabaseClient = client
}

export function setTestSupabaseUser(user: { id: string } | null) {
	testSupabaseUser.value = user
}

export function useSupabaseClient() {
	return supabaseClient
}

export function useSupabaseUser() {
	return testSupabaseUser
}

export { defineStore }
