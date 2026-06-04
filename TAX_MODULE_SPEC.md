# Mini BUH — Tax Module Specification

> Актуальна документація реалізованого модуля. Поточна версія Dexie DB: **v11**.

---

## Архітектура модуля

```
src/modules/tax/
├── index.js
├── db.js                                  # db.version(2..11) — всі міграції
├── config/
│   ├── defaultReportRules.js              # seed-дані для reportRules (нові інсталяції)
│   ├── defaultSpecialTaxTypes.js          # seed-дані для specialTaxTypes (нові інсталяції)
│   └── reportRules.js                     # застарілий файл (мертвий код — не імпортується)
├── services/
│   ├── TaxReportEngine.js                 # pure functions: profile + rules + date → reports[]
│   ├── TaxReportService.js                # Dexie CRUD для taxProfiles і taxReportInstances
│   ├── ReportRulesService.js              # Dexie CRUD для reportRules
│   └── SpecialTaxTypesService.js          # Dexie CRUD + isReferenced() для specialTaxTypes
├── stores/
│   ├── taxProfiles.js                     # Pinia: профілі клієнтів + автотеги
│   ├── taxDashboard.js                    # Pinia: дашборд звітів по всіх клієнтах
│   ├── reportRules.js                     # Pinia: довідник правил звітів
│   └── specialTaxTypes.js                 # Pinia: довідник спецподатків
├── views/
│   ├── TaxDashboardView.vue               # /tax
│   └── ClientTaxView.vue                  # вбудовано в ClientDetailView як таб
└── components/
    ├── TaxProfileForm.vue                 # форма налаштування податків клієнта
    ├── ReportRulesPanel.vue               # управління довідником правил (/settings → Звіти)
    ├── SpecialTaxTypesPanel.vue           # управління спецподатками (/settings → Спецподатки)
    ├── TaxDashboardClientGroup.vue
    ├── TaxReportRow.vue
    ├── TaxReportCard.vue
    └── TaxReportStatusBadge.vue
```

---

## Dexie Schema

### Поточна версія: v11

Нові таблиці відносно v1 (базовий CRM):

```
taxProfiles:        '++id, &clientId'
taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]'
reportRules:        '++id, &ruleId, category, active'
specialTaxTypes:    '++id, &key, active'
```

### Хронологія версій

| Версія | Що змінилось |
|--------|-------------|
| v2 | `taxProfiles`, `taxReportInstances` |
| v3 | `archivedAt` у `clients` |
| v4–7 | Billing + Payments модулі |
| v8 | `reportRules` + seed з `defaultReportRules.js` |
| v9 | Розбивка `unified_report_q` → `unified_report_legal_monthly` + `unified_report_fop_quarterly` |
| v10 | Перейменування категорій правил |
| **v11** | `specialTaxTypes` + міграція boolean-прапорців профілів і умов правил на динамічні |

---

## Таблиці БД

### taxProfiles

```js
{
  id,                        // auto-increment
  clientId,                  // FK → clients.id (унікальний)
  taxSystem:    'general' | 'simplified',
  simplifiedGroup: null | 1 | 2 | 3 | '3vat' | 4,
  vatPayer:     Boolean,     // платник ПДВ
  hasEmployees: Boolean,     // є наймані працівники
  employeeCount: Number,     // кількість найманих (інформаційно)
  specialTaxes: string[],    // ключі активних спецподатків, напр. ['excise_tax', 'land_tax']
}
```

> До v11 поля `exciseTax`, `landTax`, `environmentalTax`, `rentTax` зберігались як окремі boolean. Міграція v11 конвертує їх у `specialTaxes[]`.

### taxReportInstances

```js
{
  id,
  clientId,          // FK → clients.id
  ruleId,            // string, відповідає reportRules.ruleId
  period,            // '2026-05' | '2026-Q1' | '2026'
  dueDate,           // timestamp
  contactedAt,       // timestamp | null
  submittedAt,       // timestamp | null
  ignoredAt,         // timestamp | null
  notes,             // string
}
```

**Статуси (обчислюються, не зберігаються):**

| Поля | Статус |
|------|--------|
| `ignoredAt !== null` | `ignored` |
| `submittedAt !== null` | `submitted` |
| `contactedAt !== null` | `contacted` |
| всі null | `pending` |

### reportRules

```js
{
  id,           // auto-increment (PK у БД)
  ruleId,       // рядковий бізнес-ідентифікатор (unique); вбудовані: 'et_g1_annual' тощо; кастомні: 'custom_1717...'
  name,         // 'Декларація ЄП (Група 1)'
  shortName,    // 'ЄП гр.1'
  category,     // 'income' | 'vat_excise' | 'local' | 'resource' | 'rent' | 'financial' | 'esv' | 'other'
  frequency,    // 'monthly' | 'quarterly' | 'annual' | 'fixed_dates'
  deadline: {
    // monthly:      { type: 'day_of_next_month',    day: Number }
    // quarterly:    { type: 'days_after_period_end', value: Number }
    // annual:       { type: 'fixed_date',            month: Number, day: Number }
    // fixed_dates:  { type: 'fixed_dates',           dates: [{ month, day }, ...] }
  },
  condition: {
    clientType:           'fop' | 'legal' | 'individual' | null,
    taxSystem:            'simplified' | 'general' | null,
    simplifiedGroup:      number[] | null,   // напр. [3, '3vat']
    vatPayer:             true | null,
    hasEmployees:         true | null,
    requiredSpecialTaxes: string[] | null,   // ключі зі specialTaxTypes.key
  },
  active,       // Boolean
}
```

> До v11 умови для спецподатків задавались окремими boolean-полями (`exciseTax: true` тощо). Міграція v11 конвертує їх у `requiredSpecialTaxes[]`.

### specialTaxTypes

```js
{
  id,      // auto-increment
  key,     // унікальний рядок; вбудовані: 'excise_tax', 'land_tax', 'environmental_tax', 'rent_tax'; кастомні: 'stt_1717...'
  name,    // 'Акцизний податок'
  active,  // Boolean
}
```

**Вбудовані типи (seed при v11 upgrade та db.on('populate')):**

| key | name |
|-----|------|
| `excise_tax` | Акцизний податок |
| `land_tax` | Плата за землю |
| `environmental_tax` | Екологічний податок |
| `rent_tax` | Рентна плата |

---

## TaxReportEngine

Файл: `src/modules/tax/services/TaxReportEngine.js` — **чисті функції, без side effects**.

### evaluateCondition(cond, profile)

Перевіряє, чи підпадає клієнт під умову правила:

```
clientType          → profile.clientType === cond.clientType
taxSystem           → profile.taxSystem === cond.taxSystem
simplifiedGroup     → cond.simplifiedGroup.includes(profile.simplifiedGroup)
vatPayer            → profile.vatPayer === true
hasEmployees        → profile.hasEmployees === true
requiredSpecialTaxes→ кожен ключ з масиву присутній у profile.specialTaxes[]
```

Поле `null` або відсутнє — умова не застосовується.

### getExpectedReports(profile, year, month, rules)

```js
// profile — taxProfile з полем clientType (доданим зі stores/clients)
// rules   — activeForEngine (з useReportRulesStore): active rules з id = ruleId
// Повертає: Array<{ rule, period, dueDate, submissionStart }>
```

**Логіка частоти:**

| frequency | period | dueDate | submissionStart (початок здачі) |
|-----------|--------|---------|---------------------------------|
| `monthly` | `YYYY-MM` попереднього місяця | N-те число поточного місяця | 1-ше число місяця терміну |
| `quarterly` | `YYYY-QN` | через value днів після кінця кварталу | наступний день після кінця кварталу |
| `annual` | `YYYY` попереднього року | фіксована дата (month.day) | 1 січня поточного року |
| `fixed_dates` | `YYYY-QN` | конкретна дата зі списку | 1-ше число місяця терміну |

`submissionStart` (ms) — початок вікна здачі = наступний день після завершення звітного періоду. Для річних це 1 січня, тож декларація видима з січня по місяць крайнього терміну (див. розділ Period Encoding). UI показує це вікно у `TaxReportRow.vue` / `TaxReportCard.vue` (напр. «здача січ–тра»).

Результат відсортований за `dueDate` зростаючи.

### activeForEngine (computed у useReportRulesStore)

```js
list.value.filter(r => r.active).map(r => ({ ...r, id: r.ruleId }))
```

Engine звертається до `rule.id` — цей маппінг перетворює `ruleId` на `id`.

---

## Services

### TaxReportService

```js
// taxProfiles
getProfileByClientId(clientId)
saveProfile(clientId, data)          // upsert по clientId

// taxReportInstances
getInstance(clientId, ruleId, period)
getByClientId(clientId)
markContacted(clientId, ruleId, period, dueDate, notes?)
markSubmitted(clientId, ruleId, period, dueDate, notes?)
markIgnored(clientId, ruleId, period, dueDate)
updateNotes(id, notes)
resetStatus(id)                      // видаляє запис → статус стає pending
```

### ReportRulesService

```js
getAll()        // всі правила, відсортовані за id
create(data)
update(id, data)
remove(id)
```

### SpecialTaxTypesService

```js
getAll()                     // всі типи, відсортовані за id
add(data)                    // { key, name, active }
update(id, data)
remove(id)

// Перевіряє наявність посилань перед видаленням
isReferenced(key) → Promise<boolean>
// true якщо key присутній у будь-якому taxProfiles.specialTaxes[]
//           або у будь-якому reportRules.condition.requiredSpecialTaxes[]
```

---

## Pinia Stores

### useReportRulesStore

```js
list              // ref: всі правила з БД
activeForEngine   // computed: активні правила з id = ruleId (для TaxReportEngine)

fetchAll()
create(data)
update(id, data)
remove(id)
```

### useSpecialTaxTypesStore

```js
list         // ref: всі типи з БД

fetchAll()
create(data)   // { key, name, active }
update(id, data)
remove(id)
```

### useTaxProfilesStore

```js
profiles     // ref: Map clientId → taxProfile

load(clientId)
save(clientId, data)   // зберігає профіль + оновлює автотеги клієнта
getProfile(clientId)
```

`save` також оновлює теги клієнта через `applyTaxTags` — динамічно будує список назв тегів зі `specialTaxTypes` і синхронізує їх.

Константа `STATIC_TAX_TAG_NAMES` (список статичних назв: Група 1-4, ЄП, ПДВ, Наймані тощо) є **export**-ованою — її імпортує `ClientTagsSelect.vue`, щоб під час монтування завантажити ID системних тегів з БД і рендерити їх без кнопки закриття (`closable: false`). Системні теги (статичні + динамічні зі `specialTaxTypes`) не можна видалити через UI картки клієнта.

### useTaxDashboard (store)

```js
year, month            // поточний місяць навігації
viewMode               // 'list' | 'card' (зберігається в localStorage)

// Фільтри та пошук
nameFilter             // пошук за клієнтом (company / lastName / firstName)
categoryFilter         // масив категорій правил
statusFilter           // масив статусів
groupFilter            // id групи або null
hasActiveFilters       // computed: чи встановлено хоч один фільтр/пошук
resetFilters()         // скидає nameFilter / categoryFilter / statusFilter / groupFilter

groupedByClient        // computed: клієнти → згруповані звіти з інстанціями та статусами

refresh()              // перезавантажує instances з БД
markContacted / markSubmitted / markIgnored / updateNotes / resetStatus
```

`groupedByClient` застосовує всі фільтри й **пропускає клієнтів без жодного звіту** після фільтрації (зокрема коли фільтр категорій нічого не лишив). У заголовку клієнта показується тег його групи; клік по ньому встановлює `groupFilter` (аналог вибору у селекті «Група»).

---

## Components

### TaxProfileForm.vue

- `NRadioGroup` — система (`general` / `simplified`)
- `NRadioGroup` — група ЄП (тільки для `simplified`)
- `NSwitch` — `vatPayer`, `hasEmployees`
- `NInputNumber` — `employeeCount` (тільки якщо `hasEmployees`)
- **Динамічний список `NSwitch`** — `v-for` по `specialTaxTypes.list` (активні), прив'язаний до `form.specialTaxes[]`

Завантажує `useSpecialTaxTypesStore` самостійно в `onMounted`.

### ReportRulesPanel.vue

Управління довідником правил у `/settings → Звіти`. При редагуванні умов:
- `NCheckboxGroup` з усіма активними `specialTaxTypes` замість захардкоджених прапорців

### SpecialTaxTypesPanel.vue

Управління довідником спецподатків у `/settings → Спецподатки`:
- Список типів з перемикачем `active` та кнопками Edit/Delete
- Модальна форма для Add/Edit (поле `name`)
- **Захист видалення:** `SpecialTaxTypesService.isReferenced(key)` перевіряється перед показом діалогу — якщо є посилання, показується `message.error` без відкриття діалогу

---

## Міграція v11 — деталі

Файл: `src/modules/tax/db.js`

```js
// Константа для маппінгу старих полів → нові ключі
const OLD_FLAG_TO_KEY = {
  exciseTax:        'excise_tax',
  landTax:          'land_tax',
  environmentalTax: 'environmental_tax',
  rentTax:          'rent_tax',
}

db.version(11).stores({ ..., specialTaxTypes: '++id, &key, active' })
  .upgrade(async tx => {
    // 1. Seed вбудованих типів
    await tx.table('specialTaxTypes').bulkAdd(DEFAULT_SPECIAL_TAX_TYPES)

    // 2. taxProfiles: { exciseTax: true } → { specialTaxes: ['excise_tax'] }
    await tx.table('taxProfiles').toCollection().modify(profile => {
      profile.specialTaxes = Object.entries(OLD_FLAG_TO_KEY)
        .filter(([field]) => profile[field])
        .map(([, key]) => key)
      Object.keys(OLD_FLAG_TO_KEY).forEach(f => { profile[f] = undefined })
    })

    // 3. reportRules: { exciseTax: true } → { requiredSpecialTaxes: ['excise_tax'] }
    await tx.table('reportRules').toCollection().modify(rule => {
      if (!rule.condition) return
      const req = Object.entries(OLD_FLAG_TO_KEY)
        .filter(([field]) => rule.condition[field])
        .map(([, key]) => key)
      if (req.length) rule.condition.requiredSpecialTaxes = req
      Object.keys(OLD_FLAG_TO_KEY).forEach(f => { rule.condition[f] = undefined })
    })
  })
```

`db.on('populate')` (нові інсталяції) також сідить `specialTaxTypes` з `DEFAULT_SPECIAL_TAX_TYPES`.

---

## Вбудовані правила (defaultReportRules.js)

| ruleId | Назва | Частота | Умова |
|--------|-------|---------|-------|
| `et_g1_annual` | Декларація ЄП (Група 1) | Щорічно до 28.02 | `simplified, group=[1]` |
| `et_g2_annual` | Декларація ЄП (Група 2) | Щорічно до 28.02 | `simplified, group=[2]` |
| `et_g3_quarterly` | Декларація ЄП (Група 3) | Щоквартально +40д | `simplified, group=[3, '3vat']` |
| `vat_monthly` | Декларація ПДВ | Щомісяця до 20-го | `vatPayer=true` |
| `income_annual` | Декларація ПДФО | Щорічно до 01.05 | `general` |
| `income_advance_q` | Авансовий ПДФО | 15.03/05/08/11 | `general` |
| `unified_report_legal_monthly` | ЄСВ+4ДФ (юр. особа) | Щомісяця до 20-го | `legal, hasEmployees=true` |
| `unified_report_fop_quarterly` | ЄСВ+4ДФ (ФОП) | Щоквартально +40д | `fop, hasEmployees=true` |
| `excise_monthly` | Акцизний податок | Щомісяця до 20-го | `requiredSpecialTaxes=['excise_tax']` |
| `land_annual` | Плата за землю | Щорічно до 20.02 | `requiredSpecialTaxes=['land_tax']` |
| `env_quarterly` | Екологічний податок | Щоквартально +40д | `requiredSpecialTaxes=['environmental_tax']` |
| `rent_quarterly` | Рентна плата | Щоквартально +40д | `requiredSpecialTaxes=['rent_tax']` |

---

## Розширення системи

### Додати нове правило

1. Через `/settings → Звіти` → кнопка "Новий звіт"
2. Або безпосередньо через `ReportRulesService.create(data)` / `useReportRulesStore().create(data)`
3. При створенні через UI автоматично створюється відповідний тариф у `serviceRates`

### Додати новий тип спецподатку

1. Через `/settings → Спецподатки` → кнопка "Новий тип"
2. Новий тип з'явиться в `TaxProfileForm` і в умовах `ReportRulesPanel`
3. Видалення заблоковано, якщо хоч один профіль чи правило посилаються на цей ключ

### Зв'язок між модулями

```
specialTaxTypes.key
  ↕ (stored in)
taxProfiles.specialTaxes[]        ← TaxProfileForm
  ↕ (evaluated by)
reportRules.condition.requiredSpecialTaxes[]   ← ReportRulesPanel
  ↕ (checked by)
TaxReportEngine.evaluateCondition()
  ↕ (produces)
taxReportInstances.ruleId         → BillingModule (InvoiceGenerator)
```

---

## Period Encoding

| Тип | Приклад `period` | З'являється на дашборді місяця |
|-----|-----------------|-------------------------------|
| monthly | `'2026-05'` | Червень (dueDate = 20.06) |
| quarterly Q1 | `'2026-Q1'` | Квітень–травень (+40д від 31.03) |
| quarterly Q4 | `'2026-Q4'` | Січень–лютий наступного року |
| annual | `'2025'` | Від січня по місяць deadline (здача відкривається 1 січня) |

Правило відображення: показати звіт у місяці M, якщо вікно здачі `[початок здачі … dueDate]` перетинається з `[1-ше M, останнє число M]`. Початок здачі = наступний день після завершення звітного періоду (для річних — 1 січня поточного року).
