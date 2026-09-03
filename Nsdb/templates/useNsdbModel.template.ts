// __IMPORTS__

export function useNsdbModel(model: string, opts: { store?: boolean } = {}) {
	switch (model) {
		// __CASES__
		default:
			throw new Error(`Aucun model nsdb enregistré pour le modèle "${model}"`)
	}
}
