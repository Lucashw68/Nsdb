<template>
	<div class="p-8">
		<span id="float-nav">
			<NuxtLink to="/" class="text-purple-500">↩ Retour</NuxtLink>
		</span>

		<h1 class="mb-6 mt-4 text-4xl font-bold">NSDB, profils et RLS</h1>

		<section class="mb-8 max-w-4xl space-y-4">
			<p>
				NSDB utilise le client Supabase courant de Nuxt. Les règles d'accès doivent rester dans Supabase avec les policies RLS.
			</p>

			<ul class="list-disc space-y-2 pl-6">
				<li>Supabase Auth identifie l'utilisateur avec <code>auth.uid()</code>.</li>
				<li>La table <code>profiles</code> utilise le même id que l'utilisateur auth.</li>
				<li>Les tables métier référencent <code>profiles.id</code> ou directement <code>auth.users.id</code>.</li>
				<li>Les triggers/defaults SQL remplissent automatiquement les colonnes d'appartenance.</li>
				<li>Les RLS vérifient les droits en lecture, création, édition et suppression.</li>
			</ul>
		</section>

		<section class="grid gap-6 lg:grid-cols-2">
			<div class="rounded bg-gray-800 p-4">
				<h2 class="mb-3 text-xl font-bold">Policy RLS</h2>
				<pre class="overflow-auto whitespace-pre-wrap text-xs">{{ rlsPolicy }}</pre>
			</div>

			<div class="rounded bg-gray-800 p-4">
				<h2 class="mb-3 text-xl font-bold">Trigger SQL</h2>
				<pre class="overflow-auto whitespace-pre-wrap text-xs">{{ profileTrigger }}</pre>
			</div>

			<div class="rounded bg-gray-800 p-4">
				<h2 class="mb-3 text-xl font-bold">Création côté Nuxt</h2>
				<pre class="overflow-auto whitespace-pre-wrap text-xs">{{ createWithNsdb }}</pre>
			</div>

			<div class="rounded bg-gray-800 p-4">
				<h2 class="mb-3 text-xl font-bold">Helper profil</h2>
				<pre class="overflow-auto whitespace-pre-wrap text-xs">{{ profileHelper }}</pre>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
const rlsPolicy = `create policy "Users can read own playlists"
on playlists
for select
using (
	profile_id in (
		select id from profiles
		where id = auth.uid()
	)
);`

const profileTrigger = `create or replace function public.set_profile_id()
returns trigger as $$
begin
	if new.profile_id is null then
		new.profile_id := (select auth.uid());
	end if;

	return new;
end;
$$
language plpgsql
security definer
set search_path = '';

drop trigger if exists set_profile_id on public.playlists;

create trigger set_profile_id
before insert on public.playlists
for each row
execute function public.set_profile_id();`

const createWithNsdb = `const playlists = usePlaylists()

await playlists.create({
	title: 'Ma playlist',
})`

const profileHelper = `const { profile, profileId, ensureProfile } = useNsdbProfile({
	table: 'profiles',
	userColumn: 'id',
	createIfMissing: true,
	defaults: user => ({
		id: user.id,
		email: user.email,
	}),
})`
</script>

<style>
#float-nav {
	position: absolute;
	top: 1rem;
	left: 3rem;
	font-size: 2rem;
}
</style>
