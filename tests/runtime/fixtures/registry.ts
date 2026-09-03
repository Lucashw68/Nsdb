type ModelFactory = (options?: { store?: boolean }) => any

const factories = new Map<string, ModelFactory>()

export function setTestModel(model: string, factory: ModelFactory) {
	factories.set(model, factory)
}

export function clearTestModels() {
	factories.clear()
}

export function useNsdbModel(model: string, options: { store?: boolean } = {}) {
	const factory = factories.get(model)
	if (!factory) throw new Error(`Missing test model: ${model}`)
	return factory(options)
}
