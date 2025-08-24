export const useSupabaseApi = () => {
	const supabase = useSupabaseClient();

	// ############################################################
	// # Basic CRUD
	// ############################################################

	async function all(
		resource: string,
		select: string = '*',
		orderBy: string = 'id',
		orderDirection: 'asc' | 'desc' = 'asc',
		limit: number = 100,
		offset: number = 0
	) {
		const { data, error } = await supabase
			.from(resource)
			.select(select)
			.order(orderBy, { ascending: orderDirection === 'asc' })
			.range(offset, offset + limit - 1);
		return handleResponse(data, error, `ALL ${resource}`);
	}

	async function show(resource: string, id: string, select: string = '*') {
		const { data, error } = await supabase
			.from(resource)
			.select(select)
			.eq('id', id)
			.limit(1)
			.single();
		return handleResponse(data, error, `SHOW ${resource}/${id}`);
	}

	async function create(resource: string, payload: any) {
		const { data, error } = await supabase
			.from(resource)
			.insert(payload)
			.select()
			.single();
		return handleResponse(data, error, `CREATE ${resource}`);
	}

	async function update(resource: string, id: string, payload: any) {
		const { data, error } = await supabase
			.from(resource)
			.update(payload)
			.eq('id', id);
		return handleResponse(data, error, `UPDATE ${resource}/${id}`);
	}

	async function destroy(resource: string, id: string) {
		const { data, error } = await supabase
			.from(resource)
			.delete()
			.eq('id', id);
		return handleResponse(data, error, `DELETE ${resource}/${id}`);
	}

	// ############################################################
	// # Advanced CRUD
	// ############################################################

	async function allByProperty(
		resource: string,
		property_name: string,
		property_value: string,
		select: string = '*',
		orderBy: string = 'id',
		orderDirection: 'asc' | 'desc' = 'asc',
		limit: number = 10,
		offset: number = 0
	) {
		const { data, error } = await supabase
			.from(resource)
			.select(select)
			.eq(property_name, property_value)
			.order(orderBy, { ascending: orderDirection === 'asc' })
			.range(offset, offset + limit - 1);
		return handleResponse(data, error, `ALL ${resource} WHERE ${property_name} = ${property_value}`);
	}

	async function showByProperty(
		resource: string,
		property_name: string,
		property_value: string,
		select: string = '*'
	) {
		const { data, error } = await supabase
			.from(resource)
			.select(select)
			.eq(property_name, property_value)
			.limit(1)
			.single();
		return handleResponse(data, error, `SHOW ${resource} WHERE ${property_name} = ${property_value}`);
	}

	async function updateByProperty(
		resource: string,
		property_name: string,
		property_value: string,
		payload: any
	) {
		const { data, error } = await supabase
			.from(resource)
			.update(payload)
			.eq(property_name, property_value);
		return handleResponse(data, error, `UPDATE ${resource} WHERE ${property_name} = ${property_value}`);
	}

	async function count(resource: string) {
		const { count, error } = await supabase
			.from(resource)
			.select('*', { count: 'exact' });
		return handleResponse(count, error, `COUNT ${resource}`);
	}

	// ############################################################
	// # Common functions
	// ############################################################

	function handleResponse(data: any, error: any, context: string = 'Request') {
		if (error) {
			console.error(`❌ [${context}]`, error);
			return { success: false, error };
		}
		return { success: true, data };
	}

	return {
		all,
		show,
		create,
		update,
		destroy,
		count,
		allByProperty,
		showByProperty,
		updateByProperty
	};
};
