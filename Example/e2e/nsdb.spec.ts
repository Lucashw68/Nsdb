import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

function credentials(label: string) {
	const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
	return {
		email: `nsdb-e2e-${label}-${unique}@example.test`,
		password: `Nsdb-${unique}-password`,
	}
}

async function authenticate(page, account: { email: string; password: string }) {
	await page.getByLabel('Email').fill(account.email)
	await page.getByLabel('Password').fill(account.password)
	await page.locator('#signup').click()
	await expect(page.locator('#auth-state')).toContainText('authenticated:')
	await expect(page.locator('#e2e-error')).toBeEmpty()
}

test('Nuxt -> generated model/store -> Supabase CRUD, search, Storage and identity isolation', async ({ page }) => {
	const browserNoise: string[] = []
	page.on('console', message => {
		if (message.type() === 'warning' || message.type() === 'error') browserNoise.push(`${message.type()}: ${message.text()}`)
	})
	page.on('pageerror', error => browserNoise.push(`pageerror: ${error.message}`))
	const userA = credentials('a')
	const userB = credentials('b')
	await page.goto('/e2e')
	await expect(page.locator('[data-ready="true"]')).toBeVisible()
	await authenticate(page, userA)

	await page.locator('#playlist-title').fill('Rock E2E playlist')
	await page.locator('#create-playlist').click()
	await expect(page.locator('#playlists')).toContainText('Rock E2E playlist')

	await page.locator('[data-edit]').click()
	await expect(page.locator('#playlists')).toContainText('Renamed playlist')
	await page.locator('#playlist-search').fill('Renamed')
	await page.locator('#refresh-playlists').click()
	await expect(page.locator('#playlists li')).toHaveCount(1)

	await page.locator('#upload-file').click()
	await expect(page.locator('#storage-path')).toContainText('file with spaces.txt')
	await page.locator('#move-file').click()
	await expect(page.locator('#storage-path')).toContainText('moved file.txt')
	await page.locator('#remove-file').click()
	await expect(page.locator('#storage-path')).toBeEmpty()

	await page.locator('#logout').click()
	await expect(page.locator('#auth-state')).toHaveText('anonymous')
	await authenticate(page, userB)
	await page.locator('#refresh-playlists').click()
	await expect(page.locator('#playlists li')).toHaveCount(0)

	await page.locator('#logout').click()
	await page.getByLabel('Email').fill(userA.email)
	await page.getByLabel('Password').fill(userA.password)
	await page.locator('#login').click()
	await expect(page.locator('#playlists')).toContainText('Renamed playlist')
	await page.locator('[data-delete]').click()
	await expect(page.locator('#playlists li')).toHaveCount(0)
	expect(browserNoise).toEqual([])
})

test('persisted rows stay quarantined until the restored identity is validated', async ({ page }) => {
	const userA = credentials('persist-a')
	const userB = credentials('persist-b')
	const admin = createClient(
		process.env.NSDB_TEST_SUPABASE_URL!,
		process.env.NSDB_TEST_SERVICE_ROLE_KEY!,
		{ auth: { persistSession: false, autoRefreshToken: false } },
	)
	for (const account of [userA, userB]) {
		const { error } = await admin.auth.admin.createUser({
			email: account.email,
			password: account.password,
			email_confirm: true,
		})
		if (error) throw error
	}
	await page.addInitScript(() => {
		;(window as any).__nsdbLeakedPrivateA = false
		const inspect = () => {
			if (document.body?.innerText.includes('Private A')) {
				;(window as any).__nsdbLeakedPrivateA = true
			}
		}
		const start = () => {
			new MutationObserver(inspect).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
			inspect()
		}
		if (document.documentElement) start()
		else document.addEventListener('DOMContentLoaded', start, { once: true })
	})

	const setPersistedA = async (ownerId: string) => {
		await page.evaluate(({ ownerId }) => {
			localStorage.setItem('db_persisted_playlists', JSON.stringify({
				items: [{ id: 'private-a', title: 'Private A' }],
				totalCount: 1,
				lastFetchedAt: Date.now(),
				scopeOwnerId: ownerId,
			}))
		}, { ownerId })
	}

	const login = async (account: { email: string; password: string }) => {
		await page.getByLabel('Persistence email').fill(account.email)
		await page.getByLabel('Persistence password').fill(account.password)
		await page.locator('#persistence-login').click()
		await expect(page.locator('#persistence-auth')).toContainText('authenticated:')
		await expect(page.locator('#persistence-error')).toBeEmpty()
	}

	await page.goto('/persistence')
	await expect(page.locator('[data-persistence-fixture][data-ready="true"]')).toBeVisible()
	await login(userA)
	const ownerA = (await page.locator('#persistence-auth').textContent())!.replace('authenticated:', '')

	// Matching restored session: rows are revealed only after validation.
	await setPersistedA(ownerA)
	await page.reload()
	await expect(page.locator('#persistence-ready')).toHaveText('ready')
	await expect(page.locator('#persisted-rows')).toContainText('Private A')

	// Anonymous startup: rows never enter the rendered DOM.
	await page.locator('#persistence-logout').click()
	await expect(page.locator('#persistence-auth')).toHaveText('anonymous')
	await setPersistedA(ownerA)
	await page.reload()
	await expect(page.locator('#persistence-ready')).toHaveText('ready')
	await expect(page.locator('#persisted-rows li')).toHaveCount(0)
	expect(await page.evaluate(() => (window as any).__nsdbLeakedPrivateA)).toBe(false)

	// Different restored session: A is never rendered to B.
	await login(userB)
	await setPersistedA(ownerA)
	await page.reload()
	await expect(page.locator('#persistence-ready')).toHaveText('ready')
	await expect(page.locator('#persisted-rows li')).toHaveCount(0)
	expect(await page.evaluate(() => (window as any).__nsdbLeakedPrivateA)).toBe(false)

	// Unknown/anonymous first, then delayed B session: still no intermediate exposure.
	await page.locator('#persistence-logout').click()
	await expect(page.locator('#persistence-auth')).toHaveText('anonymous')
	await setPersistedA(ownerA)
	await page.goto(`/persistence?loginEmail=${encodeURIComponent(userB.email)}&loginPassword=${encodeURIComponent(userB.password)}`)
	await expect(page.locator('#persistence-auth')).toContainText('authenticated:')
	await expect(page.locator('#persisted-rows li')).toHaveCount(0)
	expect(await page.evaluate(() => (window as any).__nsdbLeakedPrivateA)).toBe(false)
})

test('generic List/Form provide accessible CRUD, errors and auth isolation through real RLS', async ({ page }) => {
	const userA = credentials('components-a')
	const userB = credentials('components-b')
	const title = `Component record ${Date.now()}`
	await page.goto('/e2e')
	await expect(page.locator('[data-ready="true"]')).toBeVisible()
	const fixture = page.locator('#generic-components')

	// Anonymous mutation is rejected by real RLS and the entered value survives.
	await fixture.getByLabel('Title', { exact: true }).fill(title)
	await fixture.getByRole('button', { name: 'Créer', exact: true }).click()
	await expect(fixture.getByRole('alert').first()).not.toBeEmpty()
	await expect(fixture.getByLabel('Title', { exact: true })).toHaveValue(title)

	await authenticate(page, userA)
	await fixture.getByLabel('Title', { exact: true }).fill(title)
	await fixture.getByLabel('Notes', { exact: true }).fill('Created from the generic form')
	await fixture.getByLabel('Priority', { exact: true }).fill('3')
	await fixture.getByLabel('Event date', { exact: true }).fill('2026-09-02')
	await fixture.getByLabel('Published', { exact: true }).check()
	await fixture.getByLabel('Status', { exact: true }).selectOption('published')
	await fixture.getByLabel('Title', { exact: true }).press('Enter')
	await expect(fixture.locator('tbody')).toContainText(title)
	await fixture.getByRole('button', { name: title }).click()
	await expect(fixture.getByRole('heading', { name: 'Modifier component_records' })).toBeVisible()
	const renamed = `${title} renamed`
	await fixture.getByLabel('Title', { exact: true }).fill(renamed)
	await fixture.getByRole('button', { name: 'Enregistrer' }).click()
	await expect(fixture.locator('tbody')).toContainText(renamed)

	// A second authenticated Supabase client proves browser realtime without a
	// reload or an explicit component refresh.
	const actor = createClient(process.env.NSDB_TEST_SUPABASE_URL!, process.env.NSDB_TEST_ANON_KEY!, {
		auth: { persistSession: false, autoRefreshToken: false },
	})
	expect((await actor.auth.signInWithPassword(userA)).error).toBeNull()
	const remoteTitle = `${title} remote`
	const remote = await actor.from('component_records').insert({ title: remoteTitle }).select().single()
	expect(remote.error).toBeNull()
	await expect(fixture.locator('tbody')).toContainText(remoteTitle)
	expect((await actor.from('component_records').delete().eq('id', remote.data.id)).error).toBeNull()
	await expect(fixture.locator('tbody')).not.toContainText(remoteTitle)

	// A real unique violation is visible and retryable without clearing the form.
	await fixture.getByLabel('Title', { exact: true }).fill(renamed)
	await fixture.getByRole('button', { name: 'Créer', exact: true }).click()
	await expect(fixture.getByRole('alert').first()).not.toBeEmpty()
	await expect(fixture.getByLabel('Title', { exact: true })).toHaveValue(renamed)

	// Logout and account switch synchronously quarantine A's rendered rows.
	await page.locator('#logout').click()
	await expect(fixture.locator('tbody')).not.toContainText(renamed)
	await authenticate(page, userB)
	await expect(fixture.locator('tbody')).not.toContainText(renamed)

	await page.locator('#logout').click()
	await page.getByLabel('Email').fill(userA.email)
	await page.getByLabel('Password').fill(userA.password)
	await page.locator('#login').click()
	await expect(fixture.locator('tbody')).toContainText(renamed)
	await fixture.getByRole('button', { name: 'Supprimer la ligne' }).click()
	await expect(fixture.locator('tbody')).not.toContainText(renamed)
})
