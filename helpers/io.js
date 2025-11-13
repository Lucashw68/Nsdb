// helpers/io.js
import fs from 'fs'
import path from 'path'

export function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

export function writeText(filePath, content, verbose = false) {
	ensureDir(path.dirname(filePath))
	fs.writeFileSync(filePath, content, 'utf8')
	if (verbose) console.log(`✍️  Wrote: ${path.relative(process.cwd(), filePath)}`)
}

export function readText(filePath) {
	return fs.readFileSync(filePath, 'utf8')
}

export function removeDirIfExists(dirPath, verbose = false) {
	if (!fs.existsSync(dirPath)) return false
	fs.rmSync(dirPath, { recursive: true, force: true })
	if (verbose) console.log(`🗑️  Removed dir: ${path.relative(process.cwd(), dirPath)}`)
	return true
}

export function removeFileIfExists(filePath, verbose = false) {
	if (!fs.existsSync(filePath)) return false
	fs.unlinkSync(filePath)
	if (verbose) console.log(`🗑️  Removed file: ${path.relative(process.cwd(), filePath)}`)
	return true
}

export function listFiles(dirPath) {
	return fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : []
}

export function exists(p) {
	return fs.existsSync(p)
}
