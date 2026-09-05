<template>
	<PlaygroundHeader />
	<NuxtPage id="nsdb-playground-page" />
</template>

<style>
:root {
	color-scheme: dark;
	--surface: #111827;
	--surface-soft: #1f2937;
	--border: #374151;
	--muted: #9ca3af;
	--accent: #c084fc;
}

* { box-sizing: border-box; }

html {
	background: #050505;
	font-family: 'Courier New', Courier, monospace;
	color: white;
}

body { margin: 0; }
button, input, select, textarea { font: inherit; }
button, .button {
	border: 1px solid var(--border);
	border-radius: .5rem;
	background: var(--surface-soft);
	color: white;
	padding: .55rem .8rem;
	cursor: pointer;
}
button:hover, .button:hover { border-color: var(--accent); }
button:disabled { cursor: not-allowed; opacity: .55; }
input, select, textarea {
	border: 1px solid var(--border);
	border-radius: .45rem;
	background: #030712;
	color: white;
	padding: .6rem .75rem;
}
input::placeholder, textarea::placeholder { color: #6b7280; opacity: 1; }
input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 3px solid #c084fc; outline-offset: 2px; }
code { font-family: inherit; }

.playground-header {
	position: sticky;
	top: 0;
	z-index: 20;
	display: grid;
	grid-template-columns: auto auto 1fr;
	gap: .45rem 1rem;
	align-items: center;
	padding: 1rem clamp(1rem, 4vw, 4rem);
	border-bottom: 1px solid var(--border);
	background: rgba(5, 5, 5, .94);
	backdrop-filter: blur(12px);
}
.brand { color: white; font-size: 1.25rem; font-weight: 700; text-decoration: none; }
.playground-header nav { display: flex; justify-content: flex-end; align-items: center; gap: .65rem; flex-wrap: wrap; }
.playground-header a { color: var(--accent); }
.auth-state { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.header-error { grid-column: 1 / -1; margin: 0; color: #fca5a5; font-size: .82rem; }
.environment { border: 1px solid #92400e; border-radius: 999px; color: #fbbf24; padding: .25rem .6rem; font-size: .75rem; }
.environment.local { border-color: #065f46; color: #34d399; }
.error { color: #fca5a5; }

#nsdb-playground-page { min-height: calc(100vh - 6rem); }
.demo-page, .home-page { width: min(1180px, 100%); margin: 0 auto; padding: clamp(1.25rem, 4vw, 4rem); }
.back-link, .docs-link { color: var(--accent); }
.demo-intro { margin: 2rem 0; max-width: 780px; }
.demo-intro h1, .home-page h1 { font-size: clamp(2rem, 5vw, 3.6rem); margin: 0 0 1rem; }
.demo-intro p, .home-page > p { color: var(--muted); line-height: 1.7; }
.demo-panel, .code-card { border: 1px solid var(--border); border-radius: .8rem; background: var(--surface); padding: clamp(1rem, 3vw, 2rem); }
.how-it-works { margin-top: 2rem; }
.code-card { margin: 1rem 0; background: var(--surface-soft); }
.code-card h2 { margin-top: 0; font-size: 1.05rem; }
.code-card pre { margin: 0; overflow-x: auto; line-height: 1.45; white-space: pre; }
.demo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
.demo-card { display: block; min-height: 150px; border: 1px solid var(--border); border-radius: .8rem; padding: 1.3rem; background: var(--surface); color: white; text-decoration: none; }
.demo-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.demo-card h2 { margin: 0 0 .75rem; }
.demo-card p { color: var(--muted); font-size: .9rem; line-height: 1.5; }
.controls { display: flex; flex-wrap: wrap; gap: .75rem; align-items: end; margin-bottom: 1.25rem; }
.field { display: grid; gap: .35rem; }
.field span { color: var(--muted); font-size: .8rem; }
.result-list { display: grid; gap: .65rem; padding: 0; list-style: none; }
.result-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; border: 1px solid var(--border); border-radius: .55rem; padding: .8rem; }
.result-row[data-selected='true'] { border-color: var(--accent); background: rgba(126, 34, 206, .18); box-shadow: inset 3px 0 var(--accent); }
.result-row div:last-child { display: flex; gap: .5rem; }
.muted { color: var(--muted); }

@media (max-width: 760px) {
	.playground-header { position: static; grid-template-columns: 1fr; }
	.playground-header nav { justify-content: flex-start; }
	.result-row { align-items: flex-start; flex-direction: column; }
}
</style>
