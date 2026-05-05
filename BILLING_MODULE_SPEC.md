# Mini BUH — Billing Module Specification

## Контекст проєкту

Існуючий застосунок: десктопний CRM на **NeutralinoJS + Vite 6 + Vue 3 (Composition API) + Pinia + Vue Router 4 (hash history) + Dexie 4 (IndexedDB) + Naive UI + @vicons/ionicons5**.

Поточна Dexie схема (version 3):
```js
clients:            '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt'
interactions:       '++id, clientId, type, date'
tags:               '++id, &name'
clientTags:         '++id, clientId, tagId'
taxProfiles:        '++id, &clientId'
taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]'
```

Модуль залежить від `src/modules/tax/` — використовує `taxProfiles`, `TaxReportEngine.getExpectedReports` і `reportRules.js` для автоматичної генерації рядків рахунку на основі податкового профілю клієнта.

---

## Завдання

Реалізувати модуль виставлення рахунків як **Vue Plugin** (`src/modules/billing/`), що підключається в `main.js` і не змінює жодного існуючого файлу крім `main.js` та `src/components/AppLayout.vue`.

**Ключові вимоги:**
- Таблиця вартості послуг (прайс-лист) — ціна за кожен тип звіту, повністю редагована оператором
- Зберігання повної історії змін прайсу (ціна, назва, статус активності)
- Автоматична генерація чорнового рахунку з картки податків клієнта (на основі податкового профілю і очікуваних звітів за період)
- Оператор підтверджує склад рахунку: вмикає/вимикає позиції, коригує суми
- Ручне додавання довільних послуг
- Статуси рахунку: чернетка → підтверджено → оплачено

---

## Архітектура модуля

```
src/modules/billing/
├── index.js                          # BillingPlugin { install(app, { router }) }
├── db.js                             # db.version(4) + seed serviceRates
├── config/
│   └── defaultRates.js               # стартові ціни для всіх ruleId з reportRules.js
├── services/
│   ├── BillingService.js             # CRUD: serviceRates, serviceRateHistory, invoices, invoiceLines
│   └── InvoiceGenerator.js           # pure fn: taxReportInstances + rates → draft lines
├── stores/
│   ├── billingDashboard.js           # Pinia: список рахунків + навігація по місяцях
│   └── serviceRates.js               # Pinia: управління прайсом + history
├── views/
│   ├── BillingDashboardView.vue      # /billing — список рахунків
│   ├── InvoiceFormView.vue           # /billing/new — генерація і підтвердження
│   ├── InvoiceDetailView.vue         # /billing/invoices/:id — перегляд рахунку
│   └── ServiceRatesView.vue          # /billing/rates — прайс-лист
└── components/
    ├── InvoiceLineEditor.vue          # таблиця рядків з inline редагуванням
    └── InvoiceStatusBadge.vue         # бейдж статусу рахунку
```

---

## Dexie Schema (version 4)

Файл `src/modules/billing/db.js`:

```js
import { db } from '@/db/index.js'
import { DEFAULT_RATES } from './config/defaultRates.js'

db.version(4).stores({
  // повторити всі таблиці version(3) без змін
  clients:            '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt',
  interactions:       '++id, clientId, type, date',
  tags:               '++id, &name',
  clientTags:         '++id, clientId, tagId',
  taxProfiles:        '++id, &clientId',
  taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]',
  // нові таблиці
  serviceRates:        '++id, &ruleId, active',
  serviceRateHistory:  '++id, rateId, changedAt',
  invoices:            '++id, clientId, period, number, status, createdAt',
  invoiceLines:        '++id, invoiceId, instanceId, ruleId, type, sortOrder',
}).upgrade(tx => {
  return tx.serviceRates.bulkAdd(DEFAULT_RATES)
})
```

### serviceRates — поля

```js
{
  id,           // auto
  ruleId,       // string | null — id правила з reportRules.js; null = custom послуга
  name,         // string — назва послуги (копія з rule.name або довільна)
  price,        // number — ціна в грн за одиницю (поточна)
  active,       // boolean — чи застосовується цей прайс (послуга існує і ціна актуальна)
  autoInclude,  // boolean — чи підтягувати автоматично при генерації чорнового рахунку
  updatedAt,    // timestamp — дата останньої зміни
}
```

**Різниця між `active` і `autoInclude`:**

| `active` | `autoInclude` | Поведінка |
|----------|---------------|-----------|
| true | true | Послуга діє; автоматично пропонується якщо відповідне правило є в податковій картці клієнта |
| true | false | Послуга діє; **не** пропонується автоматично, але оператор може додати вручну |
| false | — | Послуга неактивна; не з'являється ні в авто, ні в ручному списку |

**`autoInclude` = "включити цю послугу автоматично, якщо вона присутня в податковій картці клієнта."**
Тобто `autoInclude` не означає "завжди включати" — він включається тільки якщо `rule.condition(taxProfile) === true` для цього клієнта.

Якщо `active = false` → `autoInclude` ігнорується.

### serviceRateHistory — поля

```js
{
  id,           // auto
  rateId,       // FK → serviceRates.id
  snapshot: {   // повний стан запису ДО змін (JSON-об'єкт)
    name,
    price,
    active,
    autoInclude,
  },
  changedFields: string[],  // ['price'] | ['name'] | ['active'] | ['autoInclude'] | комбінації
  changedAt,    // timestamp
}
```

**Принцип роботи:** перед кожним `saveRate()` зберігається знімок (snapshot) поточного стану в `serviceRateHistory`. Таким чином можна відновити будь-який попередній стан і побачити хронологію всіх змін.

**Що не логується:** зміна `updatedAt` (технічне поле), первинне створення запису через `upgrade` seeding.

### invoices — поля

```js
{
  id,           // auto
  clientId,     // FK → clients.id
  period,       // string — '2026-05' (розрахунковий місяць)
  number,       // string — '2026-05-001' (авто-генерується: period + порядковий)
  status,       // 'draft' | 'confirmed' | 'paid' | 'cancelled'
  notes,        // string — коментар оператора
  createdAt,    // timestamp
  confirmedAt,  // timestamp | null
  paidAt,       // timestamp | null
}
```

### invoiceLines — поля

```js
{
  id,           // auto
  invoiceId,    // FK → invoices.id
  type,         // 'auto' | 'manual'
  ruleId,       // string | null — для auto-рядків: id правила
  instanceId,   // number | null — FK → taxReportInstances.id (для auto-рядків)
  name,         // string — назва (скопійована при створенні, редагована)
  qty,          // number — кількість (default: 1)
  unitPrice,    // number — ціна з прайсу на момент створення
  finalPrice,   // number | null — null = qty × unitPrice; задається при ручному коригуванні
  included,     // boolean — оператор вмикає/вимикає позицію (впливає на суму рахунку)
  notes,        // string — коментар до рядка
  sortOrder,    // number — для сортування рядків
}
```

**Підсумок рядка:** `included ? (finalPrice ?? qty * unitPrice) : 0`

**Підсумок рахунку:** сума `included` рядків.

---

## defaultRates.js

Файл `src/modules/billing/config/defaultRates.js`:

```js
export const DEFAULT_RATES = [
  { ruleId: 'et_g1_annual',     name: 'Декларація ЄП (Група 1)',               price: 150,  active: true, autoInclude: true },
  { ruleId: 'et_g2_annual',     name: 'Декларація ЄП (Група 2)',               price: 150,  active: true, autoInclude: true },
  { ruleId: 'et_g3_quarterly',  name: 'Декларація ЄП (Група 3)',               price: 200,  active: true, autoInclude: true },
  { ruleId: 'vat_monthly',      name: 'Декларація ПДВ',                        price: 300,  active: true, autoInclude: true },
  { ruleId: 'income_annual',    name: 'Декларація про майновий стан і доходи', price: 250,  active: true, autoInclude: true },
  { ruleId: 'income_advance_q', name: 'Авансовий внесок ПДФО',                price: 100,  active: true, autoInclude: true },
  { ruleId: 'unified_report_q', name: "Об'єднана звітність (ЄСВ + 4-ДФ)",    price: 250,  active: true, autoInclude: true },
  { ruleId: 'excise_monthly',   name: 'Декларація акцизного податку',          price: 200,  active: true, autoInclude: true },
  { ruleId: 'land_annual',      name: 'Декларація з плати за землю',           price: 150,  active: true, autoInclude: true },
  { ruleId: 'env_quarterly',    name: 'Декларація екологічного податку',       price: 150,  active: true, autoInclude: true },
  { ruleId: 'rent_quarterly',   name: 'Декларація рентної плати',              price: 150,  active: true, autoInclude: true },
]
```

Ціни є стартовими — оператор редагує їх у `/billing/rates`.

---

## InvoiceGenerator (pure function)

Файл `src/modules/billing/services/InvoiceGenerator.js`

```js
// Генерує чорнові рядки рахунку без звернень до БД
generateDraftLines(expectedReports, rates, instances) → InvoiceLineDraft[]
```

**Вхід:**
- `expectedReports` — результат `TaxReportEngine.getExpectedReports(taxProfile, year, month)`: масив `{ rule, period, dueDate }` — що очікується від клієнта за цей місяць згідно з його податковою карткою
- `rates` — масив `serviceRates` (всі активні, `active: true`)
- `instances` — масив `taxReportInstances` клієнта (всі існуючі, для прив'язки `instanceId`)

**Логіка:**
```
Для кожного expectedReport:
  1. Знайти rate де rate.ruleId === expectedReport.rule.id
                && rate.active === true
                && rate.autoInclude === true
  2. Якщо rate не знайдено або autoInclude=false → пропустити
  3. Знайти instance де instance.ruleId === rule.id
                    && instance.period === expectedReport.period
     (може бути null якщо звіт ще не зданий)
  4. Створити чорновий рядок:
     {
       type: 'auto',
       ruleId: expectedReport.rule.id,
       instanceId: instance?.id ?? null,   ← для довідки, не обов'язковий
       name: rate.name,
       qty: 1,
       unitPrice: rate.price,
       finalPrice: null,
       included: true,                     ← оператор може вимкнути
       notes: '',
       sortOrder: index,
     }
```

**Ключовий принцип:** рядки генеруються на основі **податкового профілю клієнта** (що він зобов'язаний здавати), а не на основі того, що вже здано. `instanceId` заповнюється якщо звіт існує в БД — суто для посилання.

**Вихід:** масив `InvoiceLineDraft[]` — готовий для відображення в `InvoiceFormView`.

---

## BillingService (DB operations)

Файл `src/modules/billing/services/BillingService.js`

```js
import { db } from '@/db/index.js'

export const BillingService = {

  // serviceRates
  async getAllRates(),
  async getActiveRates(),              // active: true (всі активні, включно з autoInclude: false)
  async getAutoRates(),                // active: true && autoInclude: true (для авто-генерації)
  async saveRate(id, data),           // update + автоматично логує в serviceRateHistory
  async addRate(data),                // add custom rate (ruleId: null), без запису в history
  async deleteRate(id),               // тільки custom (ruleId: null)

  // serviceRateHistory
  async getHistoryByRateId(rateId),   // → масив записів, сортованих changedAt desc
  async getRecentHistory(limit = 20), // останні N змін по всіх послугах

  // invoices
  async getByPeriod(period),          // всі рахунки за місяць
  async getByClientId(clientId),
  async getById(id),
  async createInvoice(data),          // status: 'draft', генерує number
  async confirmInvoice(id),           // status → 'confirmed', confirmedAt = now
  async markPaid(id),                 // status → 'paid', paidAt = now
  async cancelInvoice(id),            // status → 'cancelled'
  async updateNotes(id, notes),

  // invoiceLines
  async getLinesByInvoiceId(invoiceId),
  async bulkCreateLines(lines),       // початкове збереження draft lines
  async updateLine(id, data),         // qty, finalPrice, name, included, notes
  async addLine(data),                // ручне додавання
  async deleteLine(id),
  async reorderLines(invoiceId, orderedIds),

  // номерація
  async generateNumber(period),       // '2026-05-001', '2026-05-002', ...
}
```

**Генерація номера:** рахує існуючі рахунки за period → `${period}-${String(count + 1).padStart(3, '0')}`.

---

## Pinia Stores

### billingDashboard.js

```js
const year  = ref(currentYear)
const month = ref(currentMonth)

// Список рахунків за поточний місяць, згрупований по клієнту
const invoices = ref([])             // сирі invoice objects
const clientsMap = ref({})           // clientId → client object

const groupedByClient = computed()   // → Array<{ client, invoices[] }>

async function refresh()             // завантажує invoices + клієнтів за period
function prevMonth()
function nextMonth()
```

### serviceRates.js

```js
const rates = ref([])
const historyByRateId = ref({})      // rateId → HistoryEntry[] (завантажується на запит)

async function load()
async function save(id, data)        // → викликає BillingService.saveRate (логує history)
async function add(data)
async function remove(id)
async function loadHistory(rateId)   // завантажує history для конкретного rate

const ratesMap = computed()          // ruleId → rate (для швидкого lookup)
```

---

## Маршрути

| Шлях | Назва | Опис |
|------|-------|------|
| `/billing` | `billing-dashboard` | Список рахунків, навігація по місяцях |
| `/billing/new` | `billing-new` | Форма генерації нового рахунку |
| `/billing/invoices/:id` | `billing-invoice` | Перегляд/редагування рахунку |
| `/billing/rates` | `billing-rates` | Прайс-лист послуг |

---

## Views

### BillingDashboardView.vue (`/billing`)

```
┌─────────────────────────────────────────────────────────┐
│  Рахунки                    [← Квіт 2026 →]  [+ Новий] │
│                                                          │
│  Статус: [Всі] [Чернетка] [Підтверджено] [Оплачено]     │
├─────────────────────────────────────────────────────────┤
│  ▼ Іванов Іван (ФОП)                                    │
│    2026-04-001  квіт 2026  Підтверджено  750 грн  [...]  │
│    2026-03-001  бер 2026   Оплачено      600 грн  [...]  │
│                                                          │
│  ▼ ТОВ Ромашка                                          │
│    2026-04-002  квіт 2026  Чернетка      ---  [Редагув.] │
└─────────────────────────────────────────────────────────┘
```

- Навігація по місяцях (як на дашборді звітів): `← [місяць рік] →`
- Фільтр по статусу: `NCheckboxGroup`
- Кнопка `[+ Новий рахунок]` → вибір клієнта модалкою → перехід на `/billing/new?clientId=X&period=YYYY-MM`
- Клік на рядок рахунку → `/billing/invoices/:id`
- Сума в рядку: сума `included` рядків; для `draft` відображається як попередня

### InvoiceFormView.vue (`/billing/new`)

**Параметри:** `?clientId=X&period=YYYY-MM`

**Точка входу:** кнопка `[Сформувати рахунок]` на картці клієнта (`ClientTaxView`) — оператор вибирає місяць і переходить сюди.

**Потік:**

```
1. Завантажити taxProfile клієнта
2. TaxReportEngine.getExpectedReports(taxProfile, year, month) → expectedReports
3. Завантажити activeRates (active: true)
4. Завантажити taxReportInstances клієнта (для прив'язки instanceId)
5. InvoiceGenerator.generateDraftLines(expectedReports, rates, instances) → proposedLines
6. Показати таблицю (InvoiceLineEditor) для підтвердження оператором
7. Оператор: вмикає/вимикає рядки, редагує суми, додає ручні рядки
8. [Зберегти чернетку] → createInvoice(status:'draft') + bulkCreateLines
9. [Підтвердити рахунок] → createInvoice + bulkCreateLines + confirmInvoice
```

```
┌─────────────────────────────────────────────────────────┐
│  Новий рахунок                                           │
│  Клієнт: Іванов Іван (ФОП)    Період: Квітень 2026      │
├──┬─────────────────────────────┬──────┬────────┬────────┤
│✓ │ Послуга                     │  К-сть│  Ціна  │ Сума   │
├──┼─────────────────────────────┼──────┼────────┼────────┤
│☑ │ ЄП гр.3 (Q1)               │   1  │ 200 грн│ 200 грн│
│☑ │ ПДВ декларація (бер 2026)   │   1  │ 300 грн│ 300 грн│
│□ │ ЄСВ+4ДФ (Q1)               │   1  │ 250 грн│  ---   │
├──┴─────────────────────────────┴──────┴────────┴────────┤
│  [+ Додати послугу вручну]              Разом: 500 грн  │
├─────────────────────────────────────────────────────────┤
│  Примітка: [_________________________________]           │
│                    [Зберегти чернетку] [Підтвердити]     │
└─────────────────────────────────────────────────────────┘
```

- Рядки з `included=false` не враховуються в суму
- Ціна клікабельна → inline `NInputNumber` для редагування → при зміні встановлює `finalPrice`
- Якщо `finalPrice` задано — відображається жовтим, tooltip "змінено вручну"
- К-сть редагується inline
- Ручний рядок: назва + к-сть + ціна (ruleId: null, type: 'manual', instanceId: null)

### InvoiceDetailView.vue (`/billing/invoices/:id`)

```
┌─────────────────────────────────────────────────────────┐
│  Рахунок 2026-04-001                [Підтверджено] [...]  │
│  Клієнт: Іванов Іван · Квітень 2026                      │
│  Підтверджено: 03.05.2026                                 │
├──┬──────────────────────────────┬──────┬────────┬────────┤
│✓ │ Послуга                      │ К-сть│  Ціна  │ Сума   │
├──┼──────────────────────────────┼──────┼────────┼────────┤
│☑ │ ЄП гр.3 (Q1)                │   1  │ 200 грн│ 200 грн│
│☑ │ ПДВ декларація               │   1  │ 300 грн│ 300 грн│
├──┴──────────────────────────────┴──────┴────────┴────────┤
│                                          Разом: 500 грн  │
├─────────────────────────────────────────────────────────┤
│  [Редагувати]  [Скасувати рахунок]  [Оплачено ✓]        │
└─────────────────────────────────────────────────────────┘
```

- Для статусу `draft`: всі поля редагуються (через `InvoiceLineEditor`)
- Для статусу `confirmed`: редагування відключено, але є кнопки `[Редагувати]` і `[Оплачено]`
- Для статусу `paid`: тільки перегляд, зелена позначка
- `[Редагувати]` → переводить confirmed → draft для внесення змін
- `[...]` — dropdown: Скасувати / Друкувати (TODO)

### ServiceRatesView.vue (`/billing/rates`)

```
┌──────────────────────────────────────────────────────────────┐
│  Прайс-лист послуг                         [+ Додати свою]   │
├──┬──────────────────────────────────┬────────┬───────┬───────┤
│  │ Послуга                          │ Ціна   │Активна│ Авто  │
├──┼──────────────────────────────────┼────────┼───────┼───────┤
│▶ │ ЄП гр.1 (Декларація ЄП Група 1) │ 150 грн│  ☑   │  ☑   │
│  │  ↳ Змінено: 01.05.2026 150→200→150│       │       │       │
│  │ ЄП гр.2 (Декларація ЄП Група 2) │ 150 грн│  ☑   │  ☑   │
│  │ ЄП гр.3 (Декларація ЄП Група 3) │ 200 грн│  ☑   │  ☑   │
│  │ ПДВ декларація                   │ 300 грн│  ☑   │  ☑   │
│  │ ПДФО річна                       │ 250 грн│  ☑   │  ☑   │
│  │ ПДФО аванс                       │ 100 грн│  ☑   │  □   │ ← не в авто
│  │ ЄСВ+4ДФ                         │ 250 грн│  ☑   │  ☑   │
│  │ Акциз                            │ 200 грн│  ☑   │  ☑   │
│  │ Земля                            │ 150 грн│  ☑   │  ☑   │
│  │ Еко                              │ 150 грн│  ☑   │  ☑   │
│  │ Рента                            │ 150 грн│  ☑   │  ☑   │
│  │ ── Власні послуги ────────────── │        │       │       │
│  │ Консультація                     │ 500 грн│  ☑   │  □  🗑│ ← тільки вручну
└──┴──────────────────────────────────┴────────┴───────┴───────┘
```

- Ціна редагується inline (`NInputNumber`) — зберігається onBlur; зміна логується
- Назва редагується inline (`NInput`) — зберігається onBlur; зміна логується
- **Активна** (`active`): `NSwitch` — чи застосовується цей прайс взагалі; зміна логується
- **Авто** (`autoInclude`): `NSwitch` — чи підтягувати автоматично при генерації рахунку; зміна логується; `NSwitch` задізейблений якщо `active = false`
- Стандартні послуги (ruleId ≠ null): не видаляються, тільки деактивуються (`active: false`)
- Custom послуги (ruleId = null): можна видалити кнопкою 🗑
- `[+ Додати свою]` → inline рядок для введення назви і ціни

**Відображення історії змін:**
- Кожен рядок прайсу має кнопку `▶` (розгорнути); якщо є хоча б одна зміна — відображається індикатор (лічильник або крапка)
- При розгортанні рядка підтягується `getHistoryByRateId` і відображається `NTimeline` всередині рядка:

```
▼ ПДВ декларація  [300 грн редагується inline]  ☑
  ── Історія змін ──────────────────────────────
  03.05.2026  ціна  250 грн → 300 грн
  01.04.2026  ціна  200 грн → 250 грн
  01.03.2026  назва  "ПДВ" → "Декларація ПДВ"
  ──────────────────────────────────────────────
```

- Кожен рядок history показує: дату, що змінилося, старе та нове значення
- Для поля `active`: "деактивовано" / "активовано"
- Для поля `autoInclude`: "виключено з авто" / "включено в авто"
- Для поля `price`: "{старе} грн → {нове} грн"
- Для поля `name`: '"{старе}" → "{нове}"'
- Якщо history порожня — не показувати секцію (або "Змін не було")

---

## InvoiceLineEditor.vue

Компонент для таблиці рядків — використовується в `InvoiceFormView` (режим редагування) та `InvoiceDetailView` (режим перегляду або редагування).

**Props:**
```js
{
  lines: InvoiceLine[],
  readonly: Boolean,       // true для confirmed/paid
}
```

**Emits:**
```js
'update:line'   // { id, field, value }
'add-line'      // новий порожній рядок
'remove-line'   // { id }
```

**Поведінка:**
- Checkbox `included`: перемикає рядок — сума одразу перераховується
- Клік на ціну → inline `NInputNumber`, при зміні `finalPrice` ≠ `unitPrice` → жовтий колір, tooltip "змінено: {finalPrice} (прайс: {unitPrice})"
- Клік на к-сть → inline `NInputNumber`
- Клік на назву → inline `NInput` (тільки для manual рядків)
- `[+ Додати рядок]` → emit 'add-line'
- Рядок manual: іконка 🗑 для видалення
- Підсумок: відображається під таблицею, оновлюється реактивно

---

## InvoiceStatusBadge.vue

Props: `{ status: 'draft' | 'confirmed' | 'paid' | 'cancelled' }`

| Status | Колір | Іконка | Текст |
|---|---|---|---|
| draft | сірий | DocumentOutline | Чернетка |
| confirmed | синій | CheckmarkOutline | Підтверджено |
| paid | зелений | CheckmarkCircleOutline | Оплачено |
| cancelled | червоний | CloseCircleOutline | Скасовано |

---

## Plugin (index.js)

```js
// src/modules/billing/index.js
import BillingDashboardView from './views/BillingDashboardView.vue'
import InvoiceFormView      from './views/InvoiceFormView.vue'
import InvoiceDetailView    from './views/InvoiceDetailView.vue'
import ServiceRatesView     from './views/ServiceRatesView.vue'

export const BillingPlugin = {
  install(app, { router }) {
    router.addRoute({ path: '/billing',                name: 'billing-dashboard', component: BillingDashboardView })
    router.addRoute({ path: '/billing/new',            name: 'billing-new',       component: InvoiceFormView })
    router.addRoute({ path: '/billing/invoices/:id',   name: 'billing-invoice',   component: InvoiceDetailView, props: true })
    router.addRoute({ path: '/billing/rates',          name: 'billing-rates',     component: ServiceRatesView })
  },
}
```

---

## Зміни в існуючих файлах

### src/main.js (додати 3 рядки)

```js
import '@/modules/billing/db.js'                          // ← ПЕРЕД createApp
import { BillingPlugin } from '@/modules/billing/index.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(TaxPlugin, { router })
app.use(BillingPlugin, { router })                        // ← після TaxPlugin
app.mount('#app')
```

### src/components/AppLayout.vue (додати пункт меню)

```js
import { ..., ReceiptOutline } from '@vicons/ionicons5'

// В menuOptions додати між 'tax-dashboard' і 'settings':
{
  label: 'Рахунки',
  key: 'billing-dashboard',
  icon: renderIcon(ReceiptOutline),
  onClick: () => router.push({ name: 'billing-dashboard' }),
},
```

### src/modules/tax/views/ClientTaxView.vue (додати кнопку формування рахунку)

Кнопка розміщується в заголовку або під навігатором місяця на картці клієнта:

```html
<!-- В template, поруч із навігацією місяця -->
<n-button
  type="primary"
  size="small"
  @click="onCreateInvoice"
>
  <template #icon><n-icon><ReceiptOutline /></n-icon></template>
  Сформувати рахунок
</n-button>
```

```js
// В script setup
import { ReceiptOutline } from '@vicons/ionicons5'

function onCreateInvoice() {
  router.push({
    name: 'billing-new',
    query: {
      clientId: props.id,
      period: `${store.year}-${String(store.month).padStart(2, '0')}`,
    },
  })
}
```

Кнопка активна тільки якщо у клієнта є заповнений `taxProfile`. Якщо профілю немає — кнопка задізейблена з tooltip "Заповніть податковий профіль клієнта".

---

## Логіка генерації номера рахунку

```js
async generateNumber(period) {
  const count = await db.invoices.where('period').equals(period).count()
  return `${period}-${String(count + 1).padStart(3, '0')}`
}
// Приклади: '2026-05-001', '2026-05-002', '2026-04-003'
```

---

## Зв'язок із модулем звітів (tax)

| Поле | Звідки | Куди |
|------|--------|------|
| `taxProfiles` | tax DB | вхід для `TaxReportEngine.getExpectedReports` |
| `TaxReportEngine.getExpectedReports(profile, year, month)` | tax service | визначає які послуги клієнт має отримати за місяць |
| `taxReportInstances.id` | tax DB | `invoiceLines.instanceId` (опціонально, для довідки) |
| `taxReportInstances.ruleId + period` | tax DB | пошук існуючого instance для прив'язки |
| `reportRules.js RULES[n].id` | tax config | ключ для зв'язку `serviceRates.ruleId` |
| `reportRules.js RULES[n].name` | tax config | seed для `serviceRates.name` |

Модуль білінгу **читає** tax дані, але **не змінює** їх.

---

## Дані для авто-генерації рядків

При формуванні рахунку з `InvoiceFormView` виконується:

```js
// 1. Очікувані звіти з профілю клієнта за вибраний місяць
const expectedReports = TaxReportEngine.getExpectedReports(taxProfile, year, month)
// → [{ rule: {id:'vat_monthly',...}, period:'2026-05', dueDate:... }, ...]

// 2. Всі активні ставки для lookup
const rates = await BillingService.getActiveRates()

// 3. Існуючі instances клієнта для прив'язки instanceId
const instances = await db.taxReportInstances
  .where('clientId').equals(clientId)
  .toArray()

// 4. Генерація чорнових рядків
const draftLines = InvoiceGenerator.generateDraftLines(expectedReports, rates, instances)
```

До рахунку автоматично потрапляють послуги, де одночасно:
- `rule.condition(taxProfile) === true` — послуга є в картці клієнта
- `serviceRate.autoInclude === true` — послуга налаштована для авто-включення
- `serviceRate.active === true` — ставка діє

---

## Вимоги до UI/UX

1. **Реактивний підсумок** — при будь-якій зміні `included`, `qty`, `finalPrice` сума рахунку перераховується миттєво
2. **Inline редагування** — ціна і к-сть редагуються без окремої форми/модалки
3. **Захист від дублів** — при відкритті `InvoiceFormView` перевіряти, чи вже існує рахунок для (clientId + period); якщо так — показати `NAlert` з посиланням на існуючий
4. **Підтвердження скасування** — `NModal` підтвердження при `cancelInvoice` і при переведенні `confirmed → draft`
5. **Сортування рахунків** — на дашборді: спочатку `draft`, потім `confirmed`, потім `paid`/`cancelled`
6. **Keyboard** — `←` / `→` для навігації по місяцях на дашборді (як у tax)
7. **Empty state** — якщо за місяць немає рахунків: `NEmpty` з кнопкою `[Створити рахунок]`
8. **Зв'язок із клієнтом** — ім'я клієнта в рядку рахунку клікабельне → `/clients/:id`

---

## Технічні нотатки

- `InvoiceGenerator.js` — **чисті функції без side effects**, не звертається до БД
- `finalPrice: null` означає "використовувати `unitPrice × qty`" — не зберігати обчислену суму
- При зміні прайсу `serviceRates` — існуючі рядки рахунків **не змінюються** (зберігають `unitPrice` на момент створення)
- В авто-генерацію потрапляють тільки ставки з `active: true && autoInclude: true`
- Ставка з `active: true, autoInclude: false` — доступна для ручного додавання в `InvoiceFormView`, але не пропонується автоматично
- Деактивована ставка (`active: false`) — повністю прихована від оператора
- Custom ставки (ruleId: null) — додаються тільки вручну з `InvoiceFormView`
- Весь модуль використовує `naive-ui` компоненти і `@vicons/ionicons5` іконки
- Для таблиць рядків використовувати `NDataTable` (на відміну від tax модуля — тут таблиця з inline редагуванням виправдана)

**Логіка `BillingService.saveRate(id, data)`:**
```js
async saveRate(id, data) {
  const current = await db.serviceRates.get(id)
  // 1. визначити, які поля реально змінились
  const changedFields = ['name', 'price', 'active', 'autoInclude'].filter(f => data[f] !== current[f])
  if (changedFields.length === 0) return  // нічого не змінилось — не логувати
  // 2. зберегти snapshot поточного стану (до запису змін)
  await db.serviceRateHistory.add({
    rateId: id,
    snapshot: { name: current.name, price: current.price, active: current.active },
    changedFields,
    changedAt: Date.now(),
  })
  // 3. оновити запис
  await db.serviceRates.update(id, { ...data, updatedAt: Date.now() })
}
```

**Читання history для відображення змін у UI:**

Записи history зберігають стан **до** зміни (`snapshot`). Щоб показати "було → стало" для кожного рядка history[i]:
- "було" = `history[i].snapshot[field]`
- "стало" = `history[i-1].snapshot[field]` (наступний за часом запис) або поточне `rate[field]` для найновішого запису

```
history (desc by changedAt):
  [0] changedAt=03.05  snapshot={price:250}   changedFields=['price']  → ціна 250→300 (current)
  [1] changedAt=01.04  snapshot={price:200}   changedFields=['price']  → ціна 200→250 (history[0])
  [2] changedAt=01.03  snapshot={price:200, name:'ПДВ'}               → назва 'ПДВ'→'Декларація ПДВ' (history[1])
```
