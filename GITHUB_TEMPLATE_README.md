# ⚡ Neutralino + Vue 3 Desktop App Template

> A production-ready template for building **local-first desktop apps** without a backend.
> Zero cloud dependency. Instant startup. Runs on Windows, macOS, and Linux.

[![NeutralinoJS](https://img.shields.io/badge/NeutralinoJS-v5+-black?logo=neutralinojs)](https://neutralino.js.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vuedotjs)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff?logo=vite)](https://vitejs.dev/)
[![Dexie](https://img.shields.io/badge/Dexie-4.x-ff6b35)](https://dexie.org/)
[![Naive UI](https://img.shields.io/badge/Naive_UI-2.x-18a058)](https://www.naiveui.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why this stack?

Most desktop app frameworks are either too heavy (Electron ~150 MB overhead) or too bare-bones. This template hits a different point on the tradeoff curve:

| Concern | This template |
|---------|--------------|
| **Bundle size** | ~2 MB binary (NeutralinoJS vs Electron's ~150 MB) |
| **Backend** | None — IndexedDB via Dexie replaces the server |
| **Reactivity** | Vue 3 Composition API — everything is reactive out of the box |
| **UI components** | Naive UI — complete, themeable, no extra wiring |
| **Data persistence** | Dexie 4 — versioned schema, transactional, query-friendly |
| **Modularity** | Vue Plugin pattern — add features without touching core |

---

## What's included

```
src/
├── main.js                  # App entry — Neutralino init + plugin wiring
├── App.vue                  # Root: n-config-provider → AppLayout → RouterView
├── db/index.js              # Dexie schema v1 (core tables)
├── router/index.js          # Hash-mode router with lazy routes
├── stores/
│   └── ui.js                # Theme, page size, global UI state (persisted)
├── services/                # CRUD layer — only place that touches db
├── components/
│   └── AppLayout.vue        # Sidebar + main content shell
├── views/                   # Route-level components
└── modules/                 # Feature modules (Vue Plugin pattern)
    └── example/
        ├── index.js         # Plugin: registers routes
        ├── db.js            # Dexie schema extension
        ├── config/
        ├── services/
        ├── stores/
        ├── components/
        └── views/
```

---

## Architecture

### Layer contract

Each layer has one job and depends only on the layer below it:

```
View  →  Store  →  Service  →  Dexie (db)
         ↑
      Engine (pure functions, no db)
```

| Layer | Responsibility | Must NOT |
|-------|---------------|----------|
| `*Engine.js` | Pure business logic, computations | Touch the database |
| `*Service.js` | CRUD, Dexie transactions | Hold reactive state |
| `*Store.js` | Reactive state, computed properties | Query db directly |
| `*View.vue` | Template, UI orchestration | Contain business logic |
| `*Component.vue` | Reusable UI primitives | Access global state directly |

### Module system

Every major feature area is a self-contained Vue Plugin in `src/modules/`. Adding a feature means creating a new module directory — the core codebase is untouched.

```js
// modules/feature/index.js
export const FeaturePlugin = {
  install(app, { router }) {
    router.addRoute({
      path: '/feature',
      component: () => import('./views/FeatureDashboardView.vue')
    })
  }
}
```

```js
// main.js — wiring order matters
import '@/modules/feature/db.js'        // 1. extend schema first
import { FeaturePlugin } from '@/modules/feature/index.js'

app.use(FeaturePlugin, { router })       // 2. then register plugin
```

### Database versioning

Each module owns its schema extension. Dexie applies upgrades automatically:

```js
// Core schema — db/index.js
db.version(1).stores({ items: '++id, name, status' })

// Module extension — modules/feature/db.js
db.version(2).stores({ featureItems: '++id, itemId, type' })
```

---

## Getting started

### Prerequisites

- Node.js 18+
- Neutralino CLI: `npm install -g @neutralinojs/neu`

### Install

```bash
git clone https://github.com/your-org/your-repo.git
cd your-repo
npm install
neu update
```

### Run

```bash
# Browser only (fast UI dev — no Neutralino runtime)
npm run dev

# Full desktop app
npm run neu:dev
```

### Build & package

```bash
npm run neu:build

# Platform packages
npm run neu:package-linux   # → dist/app-linux_x64.zip
npm run neu:package-win     # → dist/app-win_x64.zip
npm run neu:package-mac     # → dist/app-mac_universal.zip
```

---

## Adding a feature module

1. Create `src/modules/yourfeature/`
2. Add `db.js` if new tables are needed — bump the version number
3. Add `index.js` with the Plugin and route registration
4. Add `services/`, `stores/`, `views/` following the layer contract
5. In `main.js`: import `db.js` first, then `use()` the plugin

That's it. No changes to the router file, no changes to App.vue.

---

## Key decisions

**Hash router** — desktop apps have no web server, so `createWebHashHistory()` is required. `createWebHistory()` will break on file:// URLs.

**Neutralino init guard** — the app must also run in a browser for development without the native binary:

```js
if (typeof Neutralino !== 'undefined' && window.NL_PORT) {
  Neutralino.init()
}
```

**db imports before createApp** — Dexie needs all version declarations registered before the first connection opens. Import all `module/db.js` files at the top of `main.js`, before `createApp()`.

---

## Tech stack

| Package | Version | Purpose |
|---------|---------|---------|
| `@neutralinojs/lib` | ^6.x | Native desktop window + OS APIs |
| `vite` | ^6.x | Build tool + dev server |
| `vue` | ^3.5 | UI framework |
| `pinia` | ^2.x | State management |
| `vue-router` | ^4.x | Client-side routing (hash mode) |
| `dexie` | ^4.x | IndexedDB ORM with migrations |
| `naive-ui` | ^2.x | Component library |
| `@vicons/ionicons5` | ^0.13 | Icon set |
| `vee-validate` | ^4.x | Form validation |
| `valibot` | ^1.x | Schema validation |
| `vitest` | ^4.x | Unit testing |
| `fake-indexeddb` | ^6.x | In-memory IndexedDB for tests |

---

## License

MIT — use it, fork it, ship it.
