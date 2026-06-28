import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { exists, readText } from './io.js'

export const defaultNsdbConfig = {
	supabase: {
		schema: 'public',
		projectId: '',
		dbUrl: '',
		linked: false,
		remoteTypes: {
			sshHost: '',
			projectPath: '',
			dbUrl: '',
			remoteOutput: '/tmp/database.types.ts',
			beforeCommand: '',
			supabaseCommand: 'npx supabase',
		},
	},
	paths: {
		types: 'types/database.types.ts',
		enums: 'nsdb/enums.ts',
		schemas: 'nsdb/schemas',
		models: 'nsdb/models',
		composables: 'nsdb/composables',
		stores: 'stores',
	},
	imports: {
		databaseTypes: '~~/types/database.types',
	},
	templates: {
		model: 'node_modules/@lucashw68/nsdb/templates/model.template.ts',
		schema: 'node_modules/@lucashw68/nsdb/templates/schema.template.ts',
		useNsdbModel: 'node_modules/@lucashw68/nsdb/templates/useNsdbModel.template.ts',
		store: 'node_modules/@lucashw68/nsdb/templates/store.template.ts',
	},
}

function isPlainObject(value) {
	return value != null && typeof value === 'object' && !Array.isArray(value)
}

function mergeConfig(baseConfig, overrideConfig) {
	const mergedConfig = { ...baseConfig }

	for (const [key, overrideValue] of Object.entries(overrideConfig ?? {})) {
		const baseValue = mergedConfig[key]
		if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
			mergedConfig[key] = mergeConfig(baseValue, overrideValue)
			continue
		}

		mergedConfig[key] = overrideValue
	}

	return mergedConfig
}

function findConfigFile(currentWorkingDirectory, explicitConfigPath) {
	if (explicitConfigPath) {
		const absoluteConfigPath = path.resolve(currentWorkingDirectory, explicitConfigPath)
		return exists(absoluteConfigPath) ? absoluteConfigPath : null
	}

	const candidates = [
		'nsdb.config.ts',
		'nsdb.config.mts',
		'nsdb.config.mjs',
		'nsdb.config.js',
		'nsdb.config.cjs',
		'nsdb.config.cts',
		'nsdb.config.json',
	]

	return candidates
		.map(candidate => path.resolve(currentWorkingDirectory, candidate))
		.find(candidatePath => exists(candidatePath)) ?? null
}

async function readConfigFile(configFilePath) {
	if (!configFilePath) return {}

	if (configFilePath.endsWith('.json')) {
		return JSON.parse(readText(configFilePath))
	}

	if (configFilePath.endsWith('.ts') || configFilePath.endsWith('.mts') || configFilePath.endsWith('.cts')) {
		const { tsImport } = await import('tsx/esm/api')
		const importedConfig = await tsImport(pathToFileURL(configFilePath).href, import.meta.url)
		return resolveConfigExport(importedConfig)
	}

	const importedConfig = await import(pathToFileURL(configFilePath).href)
	return resolveConfigExport(importedConfig)
}

function resolveConfigExport(importedConfig) {
	const configExport = importedConfig.default ?? importedConfig.nsdb ?? importedConfig

	if (
		configExport &&
		typeof configExport === 'object' &&
		configExport.__esModule &&
		configExport.default
	) {
		return configExport.default
	}

	return configExport
}

export async function loadNsdbConfig(currentWorkingDirectory, explicitConfigPath = '') {
	const configFilePath = findConfigFile(currentWorkingDirectory, explicitConfigPath)
	const fileConfig = await readConfigFile(configFilePath)

	return {
		config: mergeConfig(defaultNsdbConfig, fileConfig),
		configFilePath,
	}
}

export function getConfigValue(config, dottedPath, fallbackValue = undefined) {
	return dottedPath
		.split('.')
		.reduce((currentValue, pathPart) => currentValue?.[pathPart], config) ?? fallbackValue
}

export function getOption(parsedArguments, config, argumentName, configPath, fallbackValue = '') {
	const configValue = getConfigValue(config, configPath, fallbackValue)
	return parsedArguments.get(argumentName, configValue)
}

export function getBoolOption(parsedArguments, config, argumentName, configPath, fallbackValue = false) {
	const configValue = getConfigValue(config, configPath, fallbackValue)
	return parsedArguments.getBool(argumentName, configValue)
}
