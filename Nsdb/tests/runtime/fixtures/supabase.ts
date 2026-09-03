export type QueryCall = [string, ...unknown[]]

export class SupabaseQueryMock implements PromiseLike<any> {
	readonly calls: QueryCall[] = []

	constructor(private readonly response: any) {}

	private record(method: string, ...args: unknown[]) {
		this.calls.push([method, ...args])
		return this
	}

	select(...args: unknown[]) { return this.record('select', ...args) }
	insert(...args: unknown[]) { return this.record('insert', ...args) }
	update(...args: unknown[]) { return this.record('update', ...args) }
	delete(...args: unknown[]) { return this.record('delete', ...args) }
	upsert(...args: unknown[]) { return this.record('upsert', ...args) }
	eq(...args: unknown[]) { return this.record('eq', ...args) }
	neq(...args: unknown[]) { return this.record('neq', ...args) }
	gt(...args: unknown[]) { return this.record('gt', ...args) }
	gte(...args: unknown[]) { return this.record('gte', ...args) }
	lt(...args: unknown[]) { return this.record('lt', ...args) }
	lte(...args: unknown[]) { return this.record('lte', ...args) }
	ilike(...args: unknown[]) { return this.record('ilike', ...args) }
	in(...args: unknown[]) { return this.record('in', ...args) }
	or(...args: unknown[]) { return this.record('or', ...args) }
	order(...args: unknown[]) { return this.record('order', ...args) }
	range(...args: unknown[]) { return this.record('range', ...args) }
	limit(...args: unknown[]) { return this.record('limit', ...args) }
	single(...args: unknown[]) { return this.record('single', ...args) }

	then<TResult1 = any, TResult2 = never>(
		onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return Promise.resolve(this.response).then(onfulfilled, onrejected)
	}
}

export function createSupabaseClientMock(responses: any[]) {
	const queries: SupabaseQueryMock[] = []
	const resources: string[] = []
	const channels: any[] = []
	const responseQueue = [...responses]

	const client = {
		from(resource: string) {
			resources.push(resource)
			const query = new SupabaseQueryMock(responseQueue.shift() ?? { data: null, error: null })
			queries.push(query)
			return query
		},
		channel(name: string) {
			const channel: any = {
				name,
				on(_type: string, _filter: any, callback: (payload: any) => void) { channel.callback = callback; return channel },
				subscribe(callback?: (status: string, error?: Error) => void) { channel.statusCallback = callback; return channel },
				unsubscribe: async () => { channel.unsubscribed = true },
				emit(payload: any) { channel.callback?.(payload) },
				emitStatus(status: string, error?: Error) { channel.statusCallback?.(status, error) },
			}
			channels.push(channel)
			return channel
		},
		async removeChannel(channel: any) { await channel.unsubscribe() },
	}

	return { client, queries, resources, channels }
}
