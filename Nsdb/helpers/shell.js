// helpers/shell.js
import { execSync } from 'node:child_process'

export function run(cmd, { inherit = true, env = process.env } = {}) {
	execSync(cmd, { stdio: inherit ? 'inherit' : 'pipe', shell: true, env })
}

export function isAvailable(cmd) {
	try {
		execSync(cmd, { stdio: 'ignore' })
		return true
	} catch {
		return false
	}
}
