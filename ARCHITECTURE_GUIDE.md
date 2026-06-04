# Архітектура desktop-додатку: NeutralinoJS + Vue 3 + UI-бібліотека + IndexedDB

> Практичний гайд для відтворення цього стеку в новому проекті

---

## 1. Огляд стеку

Комбінація **NeutralinoJS + Vite + Vue 3 + Dexie (IndexedDB)** орієнтована на local-first desktop-додатки, де:

- дані зберігаються локально без сервера
- інтерфейс потребує реактивності та компонентного підходу
- розмір дистрибутиву має бути мінімальним

| Шар | Технологія | Роль |
|-----|-----------|------|
| Desktop-оболонка | NeutralinoJS | Нативне вікно, доступ до файлової системи, білд |
| Бандлер | Vite | Dev-сервер, HMR, production build |
| UI-фреймворк | Vue 3 (Composition API) | Реактивні компоненти, стан |
| Стан | Pinia | Глобальні stores |
| Маршрутизація | Vue Router 4 (hash mode) | SPA-навігація без веб-сервера |
| UI-компоненти | Naive UI | Готові компоненти, темізація |
| Іконки | @vicons/ionicons5 | SVG-іконки як Vue-компоненти |
| БД | Dexie 4 (IndexedDB) | Локальна реляційна БД у браузері |
| Валідація форм | vee-validate + valibot | Схемна валідація |
| Тести | Vitest + @vue/test-utils | Unit + компонентні тести |

---

## 2. NeutralinoJS як desktop-оболонка

### Роль у стеку

NeutralinoJS надає нативне вікно операційної системи навколо Vite/Vue SPA. Він не замінює Vue — він його обгортає.

### Структура файлів NeutralinoJS

```
neutralino.config.json   ← конфіг вікна, білду, режимів
resources/               ← статика (іконки, ресурси)
dist/                    ← Vite build + neu build output
```

### Ключові моменти конфігурації

```json
// neutralino.config.json
{
  "url": "http://localhost:5173",        // dev: Vite dev-сервер
  "documentRoot": "/dist/",              // prod: зібраний Vite bundle
  "modes": {
    "window": {
      "width": 1200, "height": 800,
      "minWidth": 900, "minHeight": 600
    }
  }
}
```

### Ініціалізація у Vue-застосунку

```js
// main.js — ініціалізувати тільки коли є Neutralino runtime
if (typeof Neutralino !== 'undefined' && window.NL_PORT) {
  Neutralino.init()
}
```

Цей guard дозволяє запускати застосунок і в браузері (dev mode без `neu run`).

### Скрипти розробки та збірки

```json
"neu:dev":    "concurrently \"vite\" \"wait-on http://localhost:5173 && neu run --url=http://localhost:5173\"",
"neu:build":  "vite build && neu build",
"neu:package-linux": "npm run neu:build && zip -j dist/app-linux.zip dist/app/app-linux_x64 dist/app/resources.neu",
"neu:package-win":   "npm run neu:build && zip -j dist/app-win.zip   dist/app/app-win_x64.exe  dist/app/resources.neu"
```

`wait-on` гарантує, що Neutralino стартує тільки після того, як Vite підняв dev-сервер.

---

## 3. Vue 3 + Pinia + Vue Router

### Composition API як стандарт

Весь компонентний код пишеться через `<script setup>`. Options API не використовується.

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMyStore } from '@/stores/myStore.js'

const store = useMyStore()
const localState = ref(null)
const derived = computed(() => store.items.filter(...))
</script>
```

### Hash-режим роутера

Desktop-додаток не має веб-сервера, тому маршрутизація через hash (`/#/path`):

```js
// router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/main-entity' },
    { path: '/main-entity', component: () => import('@/views/MainView.vue') },
    // ...
  ]
})
```

Lazy-завантаження (`() => import(...)`) для всіх views — скорочує початковий bundle.

### Структура Pinia stores

Кожен store — окремий файл із чітким розподілом:

```js
// stores/items.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ItemService } from '@/services/ItemService.js'

export const useItemsStore = defineStore('items', () => {
  const items = ref([])
  const isLoading = ref(false)

  const activeItems = computed(() => items.value.filter(i => i.status === 'active'))

  async function loadItems() {
    isLoading.value = true
    items.value = await ItemService.getAll()
    isLoading.value = false
  }

  return { items, isLoading, activeItems, loadItems }
})
```

Store відповідає за стан і реактивність, **не за бізнес-логіку** — вона в Services.

### UI store для глобального UI-стану

Окремий `stores/ui.js` для теми, розміру сторінки, модалок — без змішування з доменними stores.

---

## 4. UI-бібліотека (Naive UI)

### Підключення

Naive UI підключається через глобальний `n-config-provider` у кореневому компоненті:

```vue
<!-- App.vue -->
<template>
  <n-config-provider :theme="currentTheme" :locale="ukUA">
    <n-message-provider>
      <AppLayout />
    </n-message-provider>
  </n-config-provider>
</template>
```

### Темізація

Тема переключається реактивно через Pinia:

```js
// stores/ui.js
const theme = ref(localStorage.getItem('theme') === 'dark' ? darkTheme : null)
function toggleTheme() {
  theme.value = theme.value ? null : darkTheme
  localStorage.setItem('theme', theme.value ? 'dark' : 'light')
}
```

### Іконки

`@vicons/ionicons5` — іконки як Vue-компоненти, загортаються через `<n-icon>`:

```vue
<n-icon :component="AddOutline" />
```

---

## 5. IndexedDB через Dexie

### Центральний файл бази

```js
// src/db/index.js
import Dexie from 'dexie'

export const db = new Dexie('AppName')

db.version(1).stores({
  items:    '++id, name, status, createdAt',
  subItems: '++id, itemId, type, date',
  tags:     '++id, &name',           // & = unique
  itemTags: '++id, itemId, tagId',   // junction table
})

export const { items, subItems, tags, itemTags } = db
```

### Версіонування (міграції)

Кожна нова версія додає або змінює таблиці. Dexie застосовує їх автоматично:

```js
db.version(2).stores({
  // попередні таблиці не треба повторювати, якщо вони не змінились
  profiles: '++id, itemId',
  reports:  '++id, profileId, year, month, ruleId',
})
```

> Версія в Dexie — це номер схеми БД, не версія додатку. Збільшувати тільки при зміні схеми.

### Модульні розширення БД

Кожен модуль додає свої таблиці в окремому файлі, який імпортується **до** `createApp`:

```js
// modules/feature/db.js
import { db } from '@/db/index.js'

db.version(3).stores({
  featureItems: '++id, parentId, status',
})
```

```js
// main.js
import '@/modules/feature/db.js'   // ← спочатку всі db-розширення
import { FeaturePlugin } from '@/modules/feature/index.js'
```

### Патерн Service

Вся робота з БД — у Service-файлах. Компоненти і stores ніколи не звертаються до `db` напряму.

```js
// services/ItemService.js
import { db } from '@/db/index.js'

export const ItemService = {
  getAll: () => db.items.orderBy('createdAt').reverse().toArray(),
  getById: (id) => db.items.get(id),
  create: (data) => db.items.add({ ...data, createdAt: Date.now() }),
  update: (id, data) => db.items.update(id, data),
  delete: (id) => db.items.delete(id),
}
```

### Атомарні транзакції

Для операцій, які зачіпають кілька таблиць:

```js
async function createItemWithTags(itemData, tagIds) {
  return db.transaction('rw', db.items, db.itemTags, async () => {
    const id = await db.items.add(itemData)
    await Promise.all(tagIds.map(tagId => db.itemTags.add({ itemId: id, tagId })))
    return id
  })
}
```

---

## 6. Архітектура модулів (Vue Plugin)

### Принцип

Кожна велика функціональна область — окремий Vue Plugin у `src/modules/`. Це дає:

- самодостатній модуль зі своїми routes, stores, services, components
- чисте підключення через `app.use()`
- можливість відключити/додати модуль в одному місці

### Структура модуля

```
src/modules/feature/
├── index.js            ← Vue Plugin (реєструє routes, stores)
├── db.js               ← розширення схеми Dexie
├── config/
│   └── featureConfig.js
├── services/
│   ├── FeatureService.js   ← CRUD + бізнес-логіка
│   └── FeatureEngine.js    ← чисті функції (без side effects)
├── stores/
│   └── featureStore.js
├── components/
│   └── FeatureCard.vue
└── views/
    └── FeatureDashboardView.vue
```

### Plugin-файл

```js
// modules/feature/index.js
import { defineAsyncComponent } from 'vue'

export const FeaturePlugin = {
  install(app, { router }) {
    router.addRoute({ path: '/feature', component: () => import('./views/FeatureDashboardView.vue') })
    // за потреби: app.component(), app.provide()
  }
}
```

### Підключення в main.js

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from '@/router/index.js'
import App from './App.vue'

// 1. Спочатку — всі db-розширення
import '@/modules/feature/db.js'

// 2. Потім — plugins
import { FeaturePlugin } from '@/modules/feature/index.js'

if (typeof Neutralino !== 'undefined' && window.NL_PORT) Neutralino.init()

const app = createApp(App)
app.use(createPinia())

// 3. Plugins реєструють свої роути ДО app.use(router)
app.use(FeaturePlugin, { router })

app.use(router)
app.mount('#app')
```

> ⚠️ **Порядок важливий.** Vue Router виконує початкову навігацію вже під час `app.use(router)`. Якщо модульні плагіни (які додають роути через `router.addRoute`) підключити після роутера, то на старті їхні шляхи ще не існують — і будь-який `redirect` на такий шлях (напр. `'/' → '/feature'`) не спрацює при холодному запуску. Тому плагіни з роутами реєструються **перед** `app.use(router)`.

### Розподіл відповідальностей

| Шар | Робить | Не робить |
|-----|--------|-----------|
| `*Engine.js` | Чисті функції, бізнес-обчислення | Звертається до db |
| `*Service.js` | CRUD до db, оркестрація транзакцій | Реактивний стан |
| `*Store.js` | Реактивний стан, computed | Запити до db напряму |
| `*View.vue` | Шаблон, UI-логіка | Бізнес-логіка |
| `*Component.vue` | Перевикористовуваний UI | Глобальний стан напряму |

---

## 7. Старт нового проекту

### Порядок підключення шарів

1. `npm create vite@latest` → Vue template
2. `npm i @neutralinojs/lib` + `neu create` або вручну `neutralino.config.json`
3. `npm i pinia vue-router@4 dexie naive-ui @vicons/ionicons5`
4. `npm i vee-validate valibot`
5. `npm i -D concurrently wait-on vitest @vue/test-utils happy-dom fake-indexeddb`

### Мінімальний скаффолд

```
src/
├── main.js
├── App.vue
├── assets/main.css
├── db/index.js
├── router/index.js
├── stores/ui.js
├── components/AppLayout.vue
├── views/
│   └── HomeView.vue
└── modules/              ← додаються по мірі зростання
```

### Перший промпт для AI-генерації

```
Стек: NeutralinoJS + Vite 6 + Vue 3 (Composition API, <script setup>) +
Pinia + Vue Router 4 (hash mode) + Dexie 4 + Naive UI + @vicons/ionicons5.

Потрібно: [опис функціонального ядра].

Структура src/:
- db/index.js — Dexie схема
- router/index.js — hash router, lazy routes
- stores/ — Pinia stores (state + computed, без прямих db-запитів)
- services/ — CRUD через Dexie (без реактивного стану)
- components/ — перевикористовувані компоненти
- views/ — сторінки (підключені до router)
- App.vue — n-config-provider + n-message-provider + RouterView

Правила:
- Services звертаються до db, stores — до services
- Components не імпортують db напряму
- Всі stores через defineStore з setup-синтаксисом
- Іконки через <n-icon :component="..." />
```

---

## Ключові принципи

- **Local-first:** дані в IndexedDB, мережа — опціонально
- **Plugin-модулі:** нова область = новий `src/modules/feature/` із власним db.js, Plugin, routes
- **Розподіл шарів:** Engine (чисті функції) → Service (db) → Store (стан) → View (UI)
- **DB-версіонування:** кожен модуль розширює схему у своєму db.js, імпортованому до createApp
- **Hash router:** обов'язково для desktop без веб-сервера
- **Guard для Neutralino:** `if (typeof Neutralino !== 'undefined' && window.NL_PORT)` дозволяє dev у браузері
