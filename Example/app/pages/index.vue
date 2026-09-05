<script setup lang="ts">
const demos: ReadonlyArray<{ step?: number; group: string; to: string; icon: string; title: string; description: string }> = [
	{ step: 1, group: 'Data', to: '/crud', icon: '📦', title: 'Basic CRUD', description: 'Create, select, edit and delete a protected row through a generated model.' },
	{ group: 'Data', to: '/api', icon: '🎯', title: 'Direct API', description: 'Run the same CRUD cycle through the low-level Supabase escape hatch.' },
	{ step: 2, group: 'State', to: '/store', icon: '🗄️', title: 'Shared Store', description: 'Watch two components stay in sync through the same Pinia-backed model.' },
	{ step: 5, group: 'State', to: '/realtime', icon: '📡', title: 'Realtime', description: 'Insert outside the model and watch a subscribed collection react.' },
	{ step: 3, group: 'Components', to: '/components', icon: '👁️', title: 'NsdbList & NsdbForm', description: 'Create and edit real rows with two generic components and very little code.' },
	{ group: 'Data', to: '/relations', icon: '🔗', title: 'Relations', description: 'See a foreign key become an included, typed related row.' },
	{ step: 4, group: 'Supabase', to: '/ownership', icon: '🔐', title: 'Auth & RLS', description: 'Switch Alice to Bob and see the database return different private rows.' },
	{ group: 'Supabase', to: '/storage', icon: '🗂️', title: 'Storage', description: 'Select, upload, inspect and delete a file in a protected local bucket.' },
]
</script>

<template>
	<main class="home-page">
		<p class="eyebrow">SEE NSDB IN ACTION</p>
		<h1>What do you want to see NSDB do?</h1>
		<p>
			Every demo talks to the repository's local Supabase stack. Choose Alice or Bob in the header for protected examples,
			interact with the feature, then inspect the small piece of public NSDB code that powers it.
		</p>
		<p class="recommended"><strong>Suggested path:</strong> 1 CRUD → 2 Shared Store → 3 Components → 4 Auth/RLS → 5 Realtime</p>

		<section class="demo-grid" aria-label="NSDB demonstrations">
			<NuxtLink v-for="demo in demos" :key="demo.to" :to="demo.to" class="demo-card">
				<span class="card-meta">{{ demo.step ? `STEP ${demo.step} · ` : '' }}{{ demo.group }}</span>
				<h2>{{ demo.icon }} {{ demo.title }}</h2>
				<p>{{ demo.description }}</p>
			</NuxtLink>
		</section>
	</main>
</template>

<style scoped>
.eyebrow { color: #c084fc !important; font-weight: 700; letter-spacing: .14em; }
.demo-grid { margin-top: 2.5rem; }
.recommended { margin-top: 1.4rem; padding: .75rem 1rem; border-left: 3px solid #c084fc; background: rgba(126, 34, 206, .12); }
.card-meta { color: #a78bfa; font-size: .68rem; font-weight: 700; letter-spacing: .1em; }
</style>
