import { expect, test, type Page } from '@playwright/test'
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

function collectBrowserNoise(page: Page) {
	const browserNoise: string[] = []
	page.on('console', message => {
		if (message.type() === 'warning' || message.type() === 'error') browserNoise.push(`${message.type()}: ${message.text()}`)
	})
	page.on('pageerror', error => browserNoise.push(`pageerror: ${error.message}`))
	return browserNoise
}

async function useLocalIdentity(page: Page, name: 'Alice' | 'Bob') {
	await expect(page.locator('.playground-header')).toHaveAttribute('data-playground-ready', 'true')
	await page.getByRole('button', { name: `Use ${name}` }).click()
	await expect(page.locator('.playground-header .identity-context')).toContainText(name)
}

test('home, persistent identity and Auth/RLS explain Alice, Bob and anonymous state', async ({ page }) => {
	const noise = collectBrowserNoise(page)

	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'What do you want to see NSDB do?' })).toBeVisible()
	await expect(page.getByText('Local Supabase', { exact: true })).toBeVisible()
	await expect(page.locator('.identity-context')).toContainText('Not signed in')
	await expect(page.getByRole('link', { name: /Shared Store/ })).toBeVisible()
	await expect(page.getByRole('link', { name: /Realtime/ })).toBeVisible()
	await useLocalIdentity(page, 'Alice')
	await page.goto('/ownership')
	await expect(page.getByRole('heading', { name: 'Alice', exact: true })).toBeVisible()
	await expect(page.locator('#ownership-rows')).toContainText('Alice favourites')
	await expect(page.locator('#ownership-rows')).not.toContainText('Bob favourites')
	await page.locator('#rls-bob').click()
	await expect(page.getByRole('heading', { name: 'Bob', exact: true })).toBeVisible()
	await expect(page.locator('#ownership-rows')).toContainText('Bob favourites')
	await expect(page.locator('#ownership-rows')).not.toContainText('Alice favourites')
	await expect(page.getByText('Supabase Auth', { exact: false })).toBeVisible()
	await expect(page.getByText('RLS', { exact: true })).toBeVisible()
	await expect(page.getByText('NSDB', { exact: true }).last()).toBeVisible()
	expect(noise).toEqual([])
})

test('Basic CRUD exposes create, selected row, explicit edit, feedback and delete', async ({ page }) => {
	const noise = collectBrowserNoise(page)
	await page.goto('/crud')
	await useLocalIdentity(page, 'Alice')

	const title = `Playground CRUD ${Date.now()}`
	await page.getByLabel('New playlist title').fill(title)
	await page.locator('#crud-create').click()
	await expect(page.locator('#crud-rows')).toContainText(title)
	const selectedRow = page.locator('#crud-rows li').filter({ hasText: title })
	await expect(selectedRow).toHaveAttribute('data-selected', 'true')
	const renamed = `${title} edited`
	await page.getByLabel('New title').fill(renamed)
	await page.locator('#crud-save').click()
	await expect(page.getByRole('status')).toContainText(`Updated “${renamed}”`)
	await expect(page.locator('#crud-rows')).toContainText(renamed)
	await page.locator('#crud-delete').click()
	await expect(page.getByRole('status')).toContainText(`Deleted “${renamed}”`)
	await expect(page.locator('#crud-rows')).not.toContainText(renamed)
	expect(noise).toEqual([])
})

test('Direct API runs a complete response-object CRUD cycle', async ({ page }) => {
	const noise = collectBrowserNoise(page)
	await page.goto('/api')
	await useLocalIdentity(page, 'Alice')
	const title = `Direct CRUD ${Date.now()}`
	await page.getByLabel('New playlist title').fill(title)
	await page.locator('#api-create').click()
	await expect(page.locator('#api-result')).toContainText(`Create returned “${title}”`)
	await expect(page.locator('#api-rows')).toContainText(title)
	const renamed = `${title} edited`
	await page.getByLabel('Edit selected title').fill(renamed)
	await page.locator('#api-save').click()
	await expect(page.locator('#api-result')).toContainText('Update returned')
	await expect(page.locator('#api-rows')).toContainText(renamed)
	await page.locator('#api-delete').click()
	await expect(page.locator('#api-result')).toContainText(`Delete completed for “${renamed}”`)
	await expect(page.locator('#api-rows')).not.toContainText(renamed)
	expect(noise).toEqual([])
})

test('Shared Store mutates Consumer B and updates Consumer A without Realtime', async ({ page }) => {
	const noise = collectBrowserNoise(page)

	await page.goto('/store')
	await useLocalIdentity(page, 'Alice')
	await expect(page.getByText('no Realtime', { exact: true })).toBeVisible()
	const title = `Shared state ${Date.now()}`
	await page.getByLabel('New playlist title').fill(title)
	await page.locator('#store-create').click()
	await expect(page.locator('#consumer-a')).toContainText(title)
	await expect(page.locator('#consumer-b')).toContainText(title)
	await page.locator('#consumer-b li').filter({ hasText: title }).getByRole('button').click()
	const renamed = `${title} updated`
	await page.getByLabel('Update selected title').fill(renamed)
	await page.locator('#store-save').click()
	await expect(page.locator('#consumer-a')).toContainText(renamed)
	await expect(page.getByRole('status')).toContainText('Consumer A already shows it')
	expect(noise).toEqual([])
})

test('Realtime distinguishes an external Supabase actor from the subscribed model', async ({ page }) => {
	const noise = collectBrowserNoise(page)
	await page.goto('/realtime')
	await useLocalIdentity(page, 'Alice')
	await expect(page.getByText('Listening', { exact: true })).toBeVisible()
	const title = `External event ${Date.now()}`
	await page.getByLabel('Row title').fill(title)
	await page.locator('#realtime-external-insert').click()
	await expect(page.locator('#realtime-rows')).toContainText(title)
	await expect(page.getByRole('heading', { name: 'External Supabase client' })).toBeVisible()
	expect(noise).toEqual([])
})

test('Relations renders both the raw foreign key and resolved relation', async ({ page }) => {
	const noise = collectBrowserNoise(page)

	await page.goto('/relations')
	await expect(page.getByText('Typed bridges')).toBeVisible()
	await expect(page.getByText('foreign key', { exact: true })).toBeVisible()
	await expect(page.getByText('Ada', { exact: true })).toBeVisible()
	await expect(page.getByText('include: [\'author\'] →', { exact: true })).toBeVisible()

	await page.setViewportSize({ width: 390, height: 844 })
	await expect(page.locator('.entity-card')).toBeVisible()
	expect(noise).toEqual([])
})

test('the public generic-components demo guides a complete create, edit, search and remove flow', async ({ page }) => {
	const browserNoise = collectBrowserNoise(page)

	await page.goto('/components')
	await expect(page.getByRole('heading', { name: 'Choose a demo identity first' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Create record' })).toHaveCount(0)
	await expect(page.locator('.auth-gate')).toHaveAttribute('data-ready', 'true')

	await page.getByRole('button', { name: 'Continue as Bob' }).click()
	await expect(page.locator('[data-components-ready]')).toBeVisible()
	await expect(page.getByText('bob+playground@example.test', { exact: true }).first()).toBeVisible()

	const title = `Visible component demo ${Date.now()}`
	const titleInput = page.getByLabel('Title', { exact: true })
	await titleInput.focus()
	await titleInput.fill(title)
	await expect(titleInput).toHaveValue(title)
	const inputColors = await titleInput.evaluate(element => {
		const style = getComputedStyle(element)
		return { color: style.color, background: style.backgroundColor, outline: style.outlineStyle }
	})
	expect(inputColors.color).not.toBe(inputColors.background)
	expect(inputColors.color).toBe('rgb(249, 250, 251)')
	expect(inputColors.background).toBe('rgb(3, 7, 18)')
	expect(inputColors.outline).not.toBe('none')
	await page.getByRole('button', { name: 'Create record' }).click()
	await expect(page.getByRole('status')).toContainText('was created')
	await expect(page.getByRole('button', { name: `Edit ${title}` })).toBeVisible()

	await page.getByRole('button', { name: `Edit ${title}` }).click()
	await expect(page.getByRole('heading', { name: title })).toBeVisible()
	const renamed = `${title} renamed`
	await page.getByLabel('Title', { exact: true }).fill(renamed)
	await page.getByRole('button', { name: 'Save changes' }).click()
	await expect(page.getByRole('status')).toContainText('was updated')
	await expect(page.getByRole('button', { name: `Edit ${renamed}` })).toBeVisible()

	await page.getByPlaceholder('Search your records').fill(renamed)
	const row = page.getByRole('row').filter({ hasText: renamed })
	await expect(row).toBeVisible()
	await row.getByRole('button', { name: 'Supprimer la ligne' }).click()
	await expect(page.getByRole('button', { name: `Edit ${renamed}` })).toHaveCount(0)
	expect(browserNoise).toEqual([])
})

test('Storage shows selected metadata, upload success, file list and delete success', async ({ page }) => {
	const noise = collectBrowserNoise(page)
	await page.goto('/storage')
	await useLocalIdentity(page, 'Alice')
	const fileName = `playground-${Date.now()}.txt`
	await page.getByLabel('File to upload').setInputFiles({ name: fileName, mimeType: 'text/plain', buffer: Buffer.from('NSDB playground') })
	await expect(page.getByText(fileName, { exact: true })).toBeVisible()
	await expect(page.getByText('text/plain', { exact: true })).toBeVisible()
	await page.locator('#storage-upload').click()
	await expect(page.getByRole('status')).toContainText(`Uploaded ${fileName} successfully`)
	await expect(page.locator('#storage-files')).toContainText(fileName)
	await page.getByRole('button', { name: `Delete ${fileName}` }).click()
	await expect(page.getByRole('status')).toContainText(`Deleted ${fileName}`)
	await expect(page.locator('#storage-files')).not.toContainText(fileName)
	expect(noise).toEqual([])
})

test('public component and Storage failures remain visible with useful Supabase details', async ({ page }) => {
	const errors: string[] = []
	const pageErrors: string[] = []
	page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
	page.on('pageerror', error => pageErrors.push(error.message))

	await page.goto('/components')
	await page.getByRole('button', { name: 'Continue as Alice' }).click()
	await page.getByLabel('Title', { exact: true }).fill('Alice component row')
	await page.getByRole('button', { name: 'Create record' }).click()
	const componentError = page.locator('.form-card .demo-status[data-state="error"]')
	await expect(componentError).toContainText('Form submission failed')
	await expect(componentError).toContainText('duplicate key value')
	await expect(componentError).toContainText('23505')

	await page.goto('/storage')
	await useLocalIdentity(page, 'Alice')
	const fileName = `duplicate-${Date.now()}.txt`
	await page.getByLabel('File to upload').setInputFiles({ name: fileName, mimeType: 'text/plain', buffer: Buffer.from('first') })
	await page.locator('#storage-upload').click()
	await expect(page.getByRole('status')).toContainText('Uploaded')
	await page.locator('#storage-upload').click()
	const storageError = page.locator('.upload-card .demo-status[data-state="error"]')
	await expect(storageError).toContainText('Upload failed')
	await expect(storageError).toContainText(/already exists|duplicate/i)
	await page.getByRole('button', { name: `Delete ${fileName}` }).click()

	expect(pageErrors).toEqual([])
	expect(errors.length).toBeGreaterThanOrEqual(2)
	const unexpectedErrors = errors.filter(message => !/23505|duplicate|already exists|CREATE component_records|storage:UPLOAD|Failed to load resource.*(?:400|409)/i.test(message))
	expect(unexpectedErrors, `Unexpected console errors:\n${unexpectedErrors.join('\n')}`).toEqual([])
})

test('all public scenarios remain usable without page overflow on desktop and mobile', async ({ page }) => {
	const noise = collectBrowserNoise(page)
	const routes = ['/', '/crud', '/api', '/store', '/realtime', '/components', '/relations', '/ownership', '/storage']
	for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
		await page.setViewportSize(viewport)
		for (const route of routes) {
			await page.goto(route)
			await expect(page.locator('#nsdb-playground-page')).toBeVisible()
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
			expect(overflow, `${route} overflows at ${viewport.width}px`).toBeLessThanOrEqual(1)
		}
	}
	expect(noise).toEqual([])
})

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
