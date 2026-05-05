# Mini BUH — Tax Module Specification

## Контекст проєкту

Існуючий застосунок: десктопний CRM на **NeutralinoJS + Vite 6 + Vue 3 (Composition API) + Pinia + Vue Router 4 (hash history) + Dexie 4 (IndexedDB) + Naive UI + @vicons/ionicons5**.

Поточна Dexie схема (version 1):
```js
clients:      '++id, lastName, email, phone, company, status, clientType, createdAt'
interactions: '++id, clientId, type, date'
tags:         '++id, &name'
clientTags:   '++id, clientId, tagId'
```

Типи клієнтів: `individual` (фізична особа), `fop` (ФОП), `legal` (юридична особа).
Статуси клієнтів: `active`, `lead`, `inactive`.

DB інстанція експортується з `src/db/index.js` як `export const db = new Dexie('MiniBuh')`.

---

## Завдання

Реалізувати податковий модуль як **Vue Plugin** (`src/modules/tax/`), що підключається в `main.js` і не змінює жодного існуючого файлу крім `main.js` та `src/components/AppLayout.vue`.

---

## Архітектура модуля

```
src/modules/tax/
├── index.js                        # TaxPlugin { install(app, { router }) }
├── db.js                           # db.version(2) — імпортується до mount()
├── config/
│   └── reportRules.js              # масив RULES — engine правил
├── services/
│   ├── TaxReportEngine.js          # pure functions: profile + date → reports[]
│   └── TaxReportService.js         # Dexie CRUD для taxReportInstances
├── stores/
│   ├── taxProfiles.js              # Pinia: профілі клієнтів
│   └── taxDashboard.js             # Pinia: дашборд поточного місяця
├── views/
│   ├── TaxDashboardView.vue        # /tax
│   └── ClientTaxView.vue           # /clients/:id/tax (вбудовано в ClientDetailView)
└── components/
    ├── TaxProfileForm.vue           # форма налаштування податків клієнта
    ├── TaxDashboardClientGroup.vue  # група звітів одного клієнта
    ├── TaxReportRow.vue             # рядок звіту (list view)
    ├── TaxReportCard.vue            # картка звіту (card/grid view)
    └── TaxReportStatusBadge.vue     # бейдж статусу pending/contacted/submitted
```

---

## Dexie Schema (version 2)

Файл `src/modules/tax/db.js`:

```js
import { db } from '@/db/index.js'

db.version(2).stores({
  // повторити всі таблиці version(1) без змін
  clients:      '++id, lastName, email, phone, company, status, clientType, createdAt',
  interactions: '++id, clientId, type, date',
  tags:         '++id, &name',
  clientTags:   '++id, clientId, tagId',
  // нові таблиці
  taxProfiles:        '++id, &clientId',
  taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]',
})
```

### taxProfiles — поля

```js
{
  id,           // auto
  clientId,     // FK → clients.id (унікальний)
  taxSystem:    'general' | 'simplified',
  simplifiedGroup: null | 1 | 2 | 3 | '3vat' | 4,
  // simplified group descriptions:
  // 1 → Група 1 (до 167 МЗП, без найманих)
  // 2 → Група 2 (до 834 МЗП, до 10 найманих)
  // 3 → Група 3 (5%, без ПДВ)
  // '3vat' → Група 3 (3%, з ПДВ)
  // 4 → Група 4 (сільгосп)
  vatPayer:          Boolean,  // платник ПДВ
  hasEmployees:      Boolean,  // є наймані працівники
  employeeCount:     Number,   // кількість найманих (для інформації)
  exciseTax:         Boolean,  // акцизний податок
  landTax:           Boolean,  // плата за землю
  environmentalTax:  Boolean,  // екологічний податок
  rentTax:           Boolean,  // рентна плата
  updatedAt,
}
```

### taxReportInstances — поля

```js
{
  id,
  clientId,          // FK → clients.id
  ruleId,            // string, відповідає RULES[n].id
  period,            // string: '2026-05' | '2026-Q1' | '2026'
  dueDate,           // timestamp — конкретна дата дедлайну
  contactedAt,       // timestamp | null — клієнт повідомлений
  submittedAt,       // timestamp | null — звіт здано до ДПС
  notes,             // string — довільний коментар
  updatedAt,
}
```

**Правило статусів (обчислюється, не зберігається):**
- `submittedAt !== null` → `submitted`
- `contactedAt !== null && submittedAt === null` → `contacted`
- обидва `null` → `pending`

---

## Report Rules Engine

### Типи дедлайнів

```
day_of_next_month   → N-те число наступного місяця
days_after_period_end → через N днів після кінця кварталу
fixed_date          → фіксована дата кожного року (місяць + день)
fixed_dates         → масив фіксованих дат (для поквартальних авансів)
```

### Масив RULES (src/modules/tax/config/reportRules.js)

```js
export const RULES = [

  // ─── Єдиний податок ──────────────────────────────────
  {
    id: 'et_g1_annual',
    name: 'Декларація ЄП (Група 1)',
    shortName: 'ЄП гр.1',
    category: 'unified_tax',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 2, day: 28 },
    condition: p => p.taxSystem === 'simplified' && p.simplifiedGroup === 1,
  },
  {
    id: 'et_g2_annual',
    name: 'Декларація ЄП (Група 2)',
    shortName: 'ЄП гр.2',
    category: 'unified_tax',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 2, day: 28 },
    condition: p => p.taxSystem === 'simplified' && p.simplifiedGroup === 2,
  },
  {
    id: 'et_g3_quarterly',
    name: 'Декларація ЄП (Група 3)',
    shortName: 'ЄП гр.3',
    category: 'unified_tax',
    frequency: 'quarterly',
    deadline: { type: 'days_after_period_end', value: 40 },
    condition: p => p.taxSystem === 'simplified' && [3, '3vat'].includes(p.simplifiedGroup),
  },

  // ─── ПДВ ─────────────────────────────────────────────
  {
    id: 'vat_monthly',
    name: 'Декларація ПДВ',
    shortName: 'ПДВ',
    category: 'vat',
    frequency: 'monthly',
    deadline: { type: 'day_of_next_month', day: 20 },
    condition: p => p.vatPayer,
  },

  // ─── Загальна система ─────────────────────────────────
  {
    id: 'income_annual',
    name: 'Декларація про майновий стан і доходи',
    shortName: 'ПДФО річна',
    category: 'income_tax',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 5, day: 1 },
    condition: p => p.taxSystem === 'general',
  },
  {
    id: 'income_advance_q',
    name: 'Авансовий внесок ПДФО',
    shortName: 'ПДФО аванс',
    category: 'income_tax',
    frequency: 'fixed_dates',
    deadline: {
      type: 'fixed_dates',
      dates: [
        { month: 3, day: 15 },
        { month: 5, day: 15 },
        { month: 8, day: 15 },
        { month: 11, day: 15 },
      ],
    },
    condition: p => p.taxSystem === 'general',
  },

  // ─── Наймана праця ───────────────────────────────────
  {
    id: 'unified_report_q',
    name: "Об'єднана звітність (ЄСВ + 4-ДФ)",
    shortName: 'ЄСВ+4ДФ',
    category: 'employees',
    frequency: 'quarterly',
    deadline: { type: 'days_after_period_end', value: 40 },
    condition: p => p.hasEmployees,
  },

  // ─── Спецподатки ─────────────────────────────────────
  {
    id: 'excise_monthly',
    name: 'Декларація акцизного податку',
    shortName: 'Акциз',
    category: 'excise',
    frequency: 'monthly',
    deadline: { type: 'day_of_next_month', day: 20 },
    condition: p => p.exciseTax,
  },
  {
    id: 'land_annual',
    name: 'Декларація з плати за землю',
    shortName: 'Земля',
    category: 'land',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 2, day: 20 },
    condition: p => p.landTax,
  },
  {
    id: 'env_quarterly',
    name: 'Декларація екологічного податку',
    shortName: 'Еко',
    category: 'environmental',
    frequency: 'quarterly',
    deadline: { type: 'days_after_period_end', value: 40 },
    condition: p => p.environmentalTax,
  },
  {
    id: 'rent_quarterly',
    name: 'Декларація рентної плати',
    shortName: 'Рента',
    category: 'rent',
    frequency: 'quarterly',
    deadline: { type: 'days_after_period_end', value: 40 },
    condition: p => p.rentTax,
  },
]
```

**Додавання нового податку = один новий об'єкт в масиві RULES. Зміни в DB або engine не потрібні.**

---

## TaxReportEngine (pure functions)

Файл `src/modules/tax/services/TaxReportEngine.js`

### Функції

```js
// Повертає рядок кварталу для timestamp
getQuarter(date) → 'Q1' | 'Q2' | 'Q3' | 'Q4'

// Повертає рядок period для конкретного правила і дати
getPeriodKey(rule, date) → '2026-05' | '2026-Q1' | '2026'

// Обчислює дедлайн (timestamp) для правила і period
computeDueDate(rule, periodKey, year) → timestamp

// Основна функція: повертає список очікуваних звітів для профілю у вказаному місяці
// Повертає: Array<{ rule, period, dueDate }>
getExpectedReports(profile, year, month) → ReportItem[]
```

### Логіка getExpectedReports

```
Для кожного rule з RULES:
  1. rule.condition(profile) === false → пропустити
  2. Залежно від rule.frequency:
     - 'monthly':
         period = `${year}-${String(month).padStart(2,'0')}`
         dueDate = computeDueDate(rule, period)
         Якщо dueDate потрапляє в діапазон місяця → включити
     - 'quarterly':
         Визначити квартали, 40 днів після яких потрапляють у цей місяць
         period = `${year}-Q${quarter}`
         dueDate = останній день кварталу + 40 днів
     - 'annual':
         fixed_date: якщо rule.deadline.month === month → включити
         period = `${year}`  (або попередній рік для лютневих звітів)
     - 'fixed_dates':
         Перебрати dates, де date.month === month → включити
         period = `${year}-Q${n}` (відповідний квартал)
```

### Приклад результату для ФОП (ПДВ + наймані), травень 2026

```js
[
  {
    rule: RULES.find(r => r.id === 'vat_monthly'),
    period: '2026-05',
    dueDate: new Date('2026-06-20').getTime(),   // 20 червня — до 20 наступного місяця
  },
  {
    rule: RULES.find(r => r.id === 'unified_report_q'),
    period: '2026-Q1',
    dueDate: new Date('2026-05-11').getTime(),   // 40 днів після 31 березня
  },
  {
    rule: RULES.find(r => r.id === 'income_advance_q'),
    period: '2026-Q1',
    dueDate: new Date('2026-05-15').getTime(),   // 15 травня
  },
]
```

---

## TaxReportService (DB operations)

Файл `src/modules/tax/services/TaxReportService.js`

```js
import { db } from '@/db/index.js'

export const TaxReportService = {

  // taxProfiles
  async getProfileByClientId(clientId),
  async saveProfile(clientId, data),   // upsert

  // taxReportInstances
  async getInstance(clientId, ruleId, period),
  async getByClientId(clientId),
  async getByMonth(year, month),       // повертає всі instances з dueDate в [1.month, 1.month+1)
  async markContacted(clientId, ruleId, period, dueDate, notes),
  async markSubmitted(clientId, ruleId, period, dueDate, notes),
  async updateNotes(id, notes),
  async resetStatus(id),              // видаляє запис → статус стає pending
}
```

---

## Pinia Stores

### taxProfiles.js

```js
const profiles = ref({})           // Map clientId → taxProfile

async function load(clientId)
async function save(clientId, data)
function getProfile(clientId)      // computed getter
```

### taxDashboard.js

```js
const year = ref(currentYear)
const month = ref(currentMonth)
const viewMode = ref('list')       // 'list' | 'card' | 'grid'
const categoryFilter = ref([])     // фільтр по категорії звіту
const statusFilter = ref([])       // 'pending' | 'contacted' | 'submitted'

// Головний computed:
// 1. activeClients = clients.list.filter(status === 'active')
// 2. Для кожного — getExpectedReports(profile, year, month)
// 3. Merge з instances з БД
// 4. Групування по clientId
// 5. Фільтрація по categoryFilter та statusFilter
const groupedByClient = computed() → Array<ClientReportGroup>

// Тип ClientReportGroup:
{
  client: ClientObject,
  reports: Array<{
    rule: RuleObject,
    period: string,
    dueDate: timestamp,
    status: 'pending' | 'contacted' | 'submitted',
    instance: taxReportInstance | null,
  }>
}

async function markContacted(clientId, ruleId, period, dueDate)
async function markSubmitted(clientId, ruleId, period, dueDate)
async function refresh()           // перезавантажує instances з БД
```

---

## Views

### TaxDashboardView.vue (`/tax`)

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Звіти                        [← Квіт 2026 →]          │
│                                                          │
│  Категорії: [Всі] [ЄП] [ПДВ] [ЄСВ] [Акциз] [...]      │
│  Статус: [Всі] [⚪Очікується] [🟡Повідомлено] [🟢Здано]  │
│  Вигляд: [≡ Список] [⊞ Картки] [⊟ Таблиця]             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ── LIST VIEW ──────────────────────────────────────    │
│                                                          │
│  ▼ Іванов Іван Іванович (ФОП)        2 звіти            │
│    ⚪ ПДВ декларація    до 20.06.26   [Контакт][Здано]   │
│    🟡 ЄСВ+4ДФ          до 11.05.26   Повідомл. 02.05   │
│                                                          │
│  ▼ ТОВ Ромашка (Юридична)            3 звіти            │
│    🟢 ПДВ декларація    до 20.06.26   Здано 14.05       │
│    ⚪ ЄСВ+4ДФ          до 11.05.26   [Контакт][Здано]   │
│    ⚪ Акциз             до 20.06.26   [Контакт][Здано]   │
│                                                          │
│  ── CARD VIEW ──────────────────────────────────────    │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐     │
│  │ Іванов Іван          │  │ ТОВ Ромашка          │     │
│  │ ────────────         │  │ ────────────         │     │
│  │ ⚪ ПДВ    до 20.06   │  │ 🟢 ПДВ    Здано      │     │
│  │ 🟡 ЄСВ+4ДФ до 11.05 │  │ ⚪ ЄСВ    до 11.05   │     │
│  │                      │  │ ⚪ Акциз  до 20.06   │     │
│  └──────────────────────┘  └──────────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Деталі реалізації:**

- Перемикач місяця: `← [місяць рік] →`, навігація по місяцях
- Фільтр категорій: `NCheckboxGroup` з кольоровими бейджами категорій
- Фільтр статусу: `NCheckboxGroup`
- Перемикач вигляду: три кнопки іконками, зберігається в `taxDashboard.store.viewMode`
- Якщо у клієнта всі звіти `submitted` → collapse групи за замовчуванням, але можна розгорнути
- Кнопки `[Контакт]` та `[Здано]` — inline, без модалки. Опційно: кнопка нотатки (відкриває малий popover)
- Сортування груп: спочатку клієнти з `pending`/`contacted` звітами, потім `submitted`

### ClientTaxView.vue (`/clients/:id/tax`)

Вбудовується в `ClientDetailView.vue` як окрема секція або таб.

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Податковий профіль                    [Редагувати]      │
│                                                          │
│  Система: Спрощена, Група 3 (5%)                        │
│  ПДВ: Так  |  Наймані: 2 ос.  |  Акциз: Ні             │
├─────────────────────────────────────────────────────────┤
│  Звіти цього місяця          [← Квіт 2026 →]           │
│                                                          │
│  ⚪ ПДВ декларація      до 20.06.2026   [Контакт][Здано]│
│  🟡 ЄП гр.3 (Q1)       до 11.05.2026   Повідомл. 02.05 │
│  🟢 ЄСВ+4ДФ (Q1)       до 11.05.2026   Здано 08.05     │
└─────────────────────────────────────────────────────────┘
```

---

## Components

### TaxProfileForm.vue

- `NRadioGroup` для вибору системи (`general` / `simplified`)
- `NRadioGroup` для групи (показується якщо `simplified`)
- `NSwitch` для кожного булевого флагу
- `NInputNumber` для `employeeCount` (показується якщо `hasEmployees`)
- Submit → `TaxReportService.saveProfile()`

### TaxDashboardClientGroup.vue

Props: `{ client, reports, viewMode }`

- Заголовок групи: ім'я клієнта, тип клієнта, кількість звітів, кнопка collapse
- Підсвічування якщо є прострочені звіти (dueDate < now && status !== submitted)
- Якщо `viewMode === 'list'` → `TaxReportRow` для кожного звіту
- Якщо `viewMode === 'card'` або `'grid'` → `TaxReportCard` для кожного звіту

### TaxReportRow.vue

Props: `{ report }` де report = `{ rule, period, dueDate, status, instance }`

```
[badge] [shortName]  [dueDate]  [notes icon?]  [Контакт] [Здано]
```

- `[Контакт]` — відображається якщо status !== contacted/submitted → emit `contact`
- `[Здано]` — відображається якщо status !== submitted → emit `submit`
- Якщо contacted: показати "Повідом. {дата}" замість кнопки [Контакт]
- Якщо submitted: показати "Здано {дата}" зеленим, без кнопок
- Прострочений (dueDate < now && !submitted): dueDate червоним

### TaxReportCard.vue

Компактна картка для card/grid вигляду:

```
┌────────────────────┐
│ [badge] ПДВ        │
│ до 20.06.2026      │
│ ⚪ Очікується      │
│ [Контакт] [Здано]  │
└────────────────────┘
```

### TaxReportStatusBadge.vue

Props: `{ status: 'pending' | 'contacted' | 'submitted' }`

| Status | Колір | Іконка | Текст |
|---|---|---|---|
| pending | сірий | TimeOutline | Очікується |
| contacted | жовтий | ChatbubbleOutline | Повідомлено |
| submitted | зелений | CheckmarkCircleOutline | Здано |

---

## Plugin (index.js)

```js
// src/modules/tax/index.js
import TaxDashboardView from './views/TaxDashboardView.vue'
import ClientTaxView from './views/ClientTaxView.vue'

export const TaxPlugin = {
  install(app, { router }) {
    router.addRoute({
      path: '/tax',
      name: 'tax-dashboard',
      component: TaxDashboardView,
    })
    router.addRoute({
      path: '/clients/:id/tax',
      name: 'client-tax',
      component: ClientTaxView,
      props: true,
    })
  },
}
```

---

## Зміни в існуючих файлах

### src/main.js (додати 3 рядки)

```js
import '@/modules/tax/db.js'                          // ← ПЕРЕД createApp
import { TaxPlugin } from '@/modules/tax/index.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(TaxPlugin, { router })                        // ← після router
app.mount('#app')
```

### src/components/AppLayout.vue (додати пункт меню)

```js
import { ..., DocumentTextOutline } from '@vicons/ionicons5'

// В menuOptions додати після 'tags':
{
  label: 'Звіти',
  key: 'tax-dashboard',
  icon: renderIcon(DocumentTextOutline),
  onClick: () => router.push({ name: 'tax-dashboard' }),
},
```

### src/views/ClientDetailView.vue (додати секцію)

В template після секції тегів (`<ClientTagsSelect />`):

```html
<div class="section-label">Податки</div>
<n-button size="small" @click="$router.push({ name: 'client-tax', params: { id: client.id } })">
  Переглянути податковий профіль
</n-button>
```

Або імпортувати `ClientTaxView` і вбудувати inline (рекомендовано для швидкого доступу).

---

## Period Encoding

| Тип звіту | Приклад period | Коли з'являється на дашборді |
|---|---|---|
| monthly | `'2026-05'` | У травні (dueDate — 20 червня, але звіт за травень) |
| quarterly Q1 | `'2026-Q1'` | У квітні/травні (40 днів після 31 березня) |
| quarterly Q2 | `'2026-Q2'` | У липні/серпні |
| quarterly Q3 | `'2026-Q3'` | У жовтні/листопаді |
| quarterly Q4 | `'2026-Q4'` | У січні/лютому наступного року |
| annual | `'2026'` | У місяці з fixed_date |

**Логіка відображення на дашборді місяця M:** показувати звіт якщо `dueDate` потрапляє в діапазон `[1-го M, останнє число M]` включно. Це означає що для місячного ПДВ, period='2026-05' з dueDate=20.06.2026 — він з'явиться на дашборді **червня**, не травня.

---

## Сортування і пріоритети на дашборді

### Порядок груп клієнтів

```
1. Клієнти з простроченими звітами (dueDate < today && !submitted)  ← червона рамка
2. Клієнти з pending або contacted звітами  ← сортування по найближчому dueDate
3. Клієнти де всі звіти submitted  ← collapse за замовчуванням
```

### Порядок звітів у групі

```
1. Прострочені (dueDate < today)
2. По dueDate зростаючи
```

---

## Вимоги до UI/UX

1. **Real-time** — при кліку [Контакт] або [Здано] статус оновлюється миттєво без перезавантаження сторінки
2. **Нотатки** — при натисканні на іконку нотаток відкривається `NPopover` з `NInput` textarea, зберігається onBlur
3. **Прострочено** — якщо `dueDate < Date.now()` і статус не `submitted`: dueDate підсвічується червоним, клієнт виноситься вгору
4. **Навігація** — клік на ім'я клієнта в дашборді переходить на `/clients/:id`
5. **Persistent view mode** — вибір list/card/grid зберігається в `localStorage` (`mb_tax_view`)
6. **Active only** — на дашборд потрапляють тільки клієнти зі `status === 'active'`
7. **Порожній дашборд** — якщо немає активних клієнтів з звітами: NEmpty з посиланням на список клієнтів
8. **Keyboard**: `←` / `→` для навігації по місяцях на дашборді

---

## Технічні нотатки

- `TaxReportEngine.js` — **чисті функції без side effects**, легко тестувати
- `condition` в RULES — **стрілкова функція** що приймає `taxProfile` і повертає `Boolean`
- При відсутності `taxProfile` для клієнта — клієнт не з'являється на дашборді (показується порожній профіль у `ClientTaxView` з пропозицією заповнити)
- `taxReportInstances` не містить рядка `status` — статус обчислюється в runtime з полів `contactedAt`/`submittedAt`
- Весь модуль використовує `naive-ui` компоненти і `@vicons/ionicons5` іконки як і основний застосунок
- Не використовувати `NDataTable` для списків — використовувати `NList` / `NListItem` / `NThing` для консистентності з рештою застосунку, крім `grid` вигляду де використовувати CSS grid з `NCard`
