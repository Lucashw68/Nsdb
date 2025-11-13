// helpers/shell.js
import { execSync } from 'node:child_process'

export function run(cmd, { inherit = true } = {}) {
	execSync(cmd, { stdio: inherit ? 'inherit' : 'pipe', shell: true })
}

export function isAvailable(cmd) {
	try {
		execSync(cmd, { stdio: 'ignore' })
		return true
	} catch {
		return false
	}
}
