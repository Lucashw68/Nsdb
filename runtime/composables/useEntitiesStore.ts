import { modelMap } from '@/types/models'

export const useEntities = () => {
	const entities = {} as {
		[K in keyof typeof modelMap]: ReturnType<ReturnType<typeof modelMap[K]>>
	}

	for (const key in modelMap) {
		entities[key as keyof typeof modelMap] = modelMap[key as keyof typeof modelMap]()
	}

	return entities
}
