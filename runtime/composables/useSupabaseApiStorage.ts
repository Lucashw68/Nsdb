// export const useSupabaseApiStorage = () => {
//     // const supabase = useNuxtApp().$nsdbSupabase
//     const supabase = useSupabaseClient?.()

//     // ############################################################
//     // # Buckets
//     // ############################################################

//     async function all(bucket: string, path: string = '', limit: number = 100, orderBy: string = 'name', orderDirection: 'asc' | 'desc' = 'asc') {
//         try {
//             const { data, error } = await supabase
//                 .storage
//                 .from(bucket)
//                 .list(path, {
//                     limit: 100,
//                     offset: 0,
//                     sortBy: { column: 'name', order: 'asc' },
//                 })
//             return await handleResponse(data, error)
//         } catch (error) {
//             console.error('Error in all from bucket function:', error);
//             throw error;
//         }
//     }

//     async function upload(bucket: string, path: string, file: File, upsert = false) {
//         try {
//             const { data, error } = await supabase
//                 .storage
//                 .from(bucket)
//                 .upload(path, file, { upsert })
//             console.log('Upload data:', data)
//             console.log('Upload error:', error)
//             return await handleResponse(data, error)
//         } catch (error) {
//             console.error('Error uploading file to bucket:', error)
//             throw error
//         }
//     }

//     // ############################################################
//     // # Common functions
//     // ############################################################

//     async function handleResponse(data: any, error: any, debug = true) {
//         if (error) {
//             if (debug) console.error('Error in handleResponse:', error);
//             throw error;
//         }
//         return data;
//     }

//     return {
//         all,
//         upload
//     }
// }
