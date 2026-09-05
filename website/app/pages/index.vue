<script setup lang="ts">
useSeoMeta({
  title: 'NSDB — Nuxt Supabase Data Bridge',
  description: 'The typed data layer between Nuxt and Supabase.',
  ogTitle: 'NSDB — Nuxt Supabase Data Bridge',
  ogDescription: 'Supabase data in Nuxt, without the repetitive CRUD layer.',
})

const capabilities = [
  { icon: 'i-lucide-wand-sparkles', title: 'Generated from Supabase', text: 'Row, Insert, and Update types, schemas, relations, and metadata.' },
  { icon: 'i-lucide-braces', title: 'Typed CRUD', text: 'Readable fetch, create, update, and remove calls from Vue components.' },
  { icon: 'i-lucide-database-zap', title: 'Optional shared state', text: 'Add Pinia cache, TTL, and identity-safe persistence only where needed.' },
  { icon: 'i-lucide-radio', title: 'Realtime', text: 'Opt in to Supabase Realtime with an explicit lifecycle.' },
  { icon: 'i-lucide-panels-top-left', title: 'Generic UI', text: 'Start with NsdbList and NsdbForm, then override only what is specific.' },
  { icon: 'i-lucide-shield-check', title: 'Supabase stays Supabase', text: 'Auth, RLS, Storage, and PostgREST remain available and authoritative.' },
]
</script>

<template>
  <div class="landing">
    <section class="hero">
      <div class="hero-grid">
        <div>
          <p class="eyebrow"><BrandMark /> Nuxt Supabase Data Bridge</p>
          <h1>NSDB <span>The typed data layer between Nuxt and Supabase.</span></h1>
          <p class="hero-lead">Generate the repetitive client layer from your Supabase schema, then query and mutate typed rows through a small Nuxt API.</p>
          <div class="hero-actions">
            <UButton to="/docs/getting-started/quick-start" size="lg" trailing-icon="i-lucide-arrow-right">Get started</UButton>
            <UButton to="/docs/getting-started/introduction" size="lg" color="neutral" variant="outline">Read the docs</UButton>
          </div>
        </div>
        <div class="code-window" aria-label="Generated model example">
          <div class="code-window-bar">app/pages/example.vue <span>TypeScript</span></div>
          <pre><code><span class="code-keyword">const</span> exampleTable = <span class="code-call">useExampleTable</span>({ <span class="code-property">store</span>: <span class="code-keyword">true</span> })

<span class="code-keyword">await</span> exampleTable.<span class="code-call">fetch</span>()

<span class="code-keyword">const</span> entry = <span class="code-keyword">await</span> exampleTable.<span class="code-call">create</span>({
  <span class="code-property">title</span>: <span class="code-string">'My entry'</span>,
})

<span class="code-keyword">await</span> exampleTable.<span class="code-call">update</span>(entry, {
  <span class="code-property">title</span>: <span class="code-string">'Renamed'</span>,
})

<span class="code-keyword">await</span> exampleTable.<span class="code-call">remove</span>(entry)</code></pre>
        </div>
      </div>
    </section>

    <section class="landing-section">
      <p class="section-kicker">One small surface</p>
      <h2 class="section-title">From database types to useful Vue code.</h2>
      <p class="section-copy">NSDB generates compact bindings and keeps the runtime generic. You get strong types without moving your data model away from Supabase.</p>
      <div class="feature-grid">
        <Feature v-for="feature in capabilities" :key="feature.title" :icon="feature.icon" :title="feature.title">{{ feature.text }}</Feature>
      </div>
    </section>

    <section class="landing-section">
      <p class="section-kicker">The bridge</p>
      <h2 class="section-title">A predictable path to your component.</h2>
      <div class="workflow" aria-label="NSDB data flow">
        <div v-for="step in [
          ['i-lucide-database', 'Supabase'],
          ['i-lucide-file-json-2', 'Generated types'],
          ['i-lucide-box', 'NSDB models'],
          ['i-lucide-layers-3', 'Optional store'],
          ['i-lucide-component', 'Vue / Nuxt'],
        ]" :key="step[1]" class="workflow-step">
          <Icon :name="step[0]" />
          <strong>{{ step[1] }}</strong>
        </div>
      </div>
    </section>

    <section class="landing-section component-showcase">
      <div>
        <p class="section-kicker">Database to UI</p>
        <h2 class="section-title">Useful defaults. Your design.</h2>
        <p class="section-copy">Render a semantic list or form from generated metadata. Use slots and normal CSS when the application needs something specific.</p>
        <UButton to="/docs/components/nsdb-list" color="neutral" variant="link" trailing-icon="i-lucide-arrow-right">Explore components</UButton>
      </div>
      <div class="code-window" aria-label="NSDB component example">
        <div class="code-window-bar">app/pages/example.vue <span>Vue</span></div>
        <pre><code>&lt;<span class="code-call">NsdbList</span>
  <span class="code-property">model</span>=<span class="code-string">"exampleTable"</span>
  <span class="code-property">store</span>
  <span class="code-property">searchable</span>
  :<span class="code-property">search-columns</span>=<span class="code-string">"['title']"</span>
/&gt;

&lt;<span class="code-call">NsdbForm</span>
  <span class="code-property">model</span>=<span class="code-string">"exampleTable"</span>
  <span class="code-property">store</span>
/&gt;</code></pre>
      </div>
    </section>

    <section class="landing-section">
      <div class="landing-cta">
        <div>
          <p class="section-kicker">Start with one table</p>
          <h2 class="section-title">Generate your first model.</h2>
          <p class="section-copy">Install the module, connect the Supabase CLI, and finish with <code>await exampleTable.fetch()</code>.</p>
        </div>
        <UButton to="/docs/getting-started/quick-start" size="xl" trailing-icon="i-lucide-arrow-right">Quick start</UButton>
      </div>
    </section>
  </div>
</template>
