import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const status = JSON.parse(execFileSync(
	path.resolve('node_modules/.bin/supabase'),
	['status', '--workdir', '..', '-o', 'json'],
	{ encoding: 'utf8' },
))

// Also expose the local credentials to the Playwright worker. Browser tests use
// the service role only to create deterministic Auth fixtures before exercising
// the public client in Chromium.
process.env.NSDB_TEST_SUPABASE_URL = status.API_URL
process.env.NSDB_TEST_ANON_KEY = status.ANON_KEY
process.env.NSDB_TEST_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: 'http://127.0.0.1:3310',
		trace: 'retain-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'yarn dev --host 127.0.0.1 --port 3310',
		url: 'http://127.0.0.1:3310/e2e',
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			...process.env,
			SUPABASE_URL: status.API_URL,
			SUPABASE_KEY: status.ANON_KEY,
		},
	},
})
