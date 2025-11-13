// helpers/args.js
export function parseArgs(argv = process.argv.slice(2)) {
	const args = [...argv]

	const get = (name, def = '') => {
		const i = args.findIndex(a => a === `--${name}`)
		return i !== -1 && args[i + 1] ? args[i + 1] : def
	}

	const getBool = (name, def = false) => {
		const i = args.findIndex(a => a === `--${name}`)
		if (i === -1) return def
		const next = args[i + 1]
		if (next === 'true') return true
		if (next === 'false') return false
		return true
	}

	const rest = () => args.filter(a => !a.startsWith('--') && !a.startsWith('-'))

	return { get, getBool, rest, raw: args }
}
