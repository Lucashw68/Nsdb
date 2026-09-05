# NSDB documentation website

Public, repository-owned documentation for NSDB. The site is an independent static Nuxt 4 application using Nuxt Content, Nuxt UI, TypeScript, and `@nuxt/icon`.

## Local development

Requires Node.js 22.14 or newer.

```bash
npm install --legacy-peer-deps
npm run dev
```

## Validation

```bash
npm run typecheck
npm run generate
npm run preview
```

Static output is written to `.output/public/` and is intentionally ignored by Git.

## Content structure

User documentation lives in `content/`, grouped by numbered sections so Nuxt Content produces stable navigation order. Folder `.navigation.yml` files define section labels. Repository development and security guidance lives in the root `CONTRIBUTING.md` and `SECURITY.md` files.

Application chrome and layouts live under `app/`. Reusable MDC helpers such as `Callout`, `Feature`, and `ApiBadge` live in `app/components/content/`; installation tabs use Nuxt UI's native code group.

The displayed RC version is read once from `../Nsdb/package.json` at build time.

## Deployment

Deploy the contents of `.output/public/` to any static host. Compatible choices include Cloudflare Pages, Netlify, Vercel static hosting, and GitHub Pages. Configure the platform to run:

```text
Install command: npm install
Build command: npm run generate
Output directory: .output/public
```

For a subpath deployment such as GitHub Pages project sites, set Nuxt's `app.baseURL` for that target before generating. No deployment or package publication is performed by this repository.
