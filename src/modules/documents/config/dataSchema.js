// Опис схеми даних застосунку для генерації блоку тегів.
// Кожна таблиця описує: label, ns (префікс токенів), поля та звʼязки (FK) на інші
// таблиці. Палітра тегів будується автоматично: базова таблиця + всі таблиці,
// на які вона посилається. `documentBase: true` — таблиця може бути основою документа.

import { DEFAULT_BODY as INVOICE_DEFAULT_BODY } from './invoiceTokenTemplate.js'

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

function periodLabel(period) {
  if (!period) return ''
  const [y, m] = String(period).split('-')
  return `${UA_MONTHS[Number(m) - 1] ?? ''} ${y}`.trim()
}

function clientName(c) {
  if (!c) return ''
  return c.clientType === 'legal'
    ? (c.company ?? '')
    : `${c.lastName ?? ''} ${c.firstName ?? ''}${c.middleName ? ' ' + c.middleName : ''}`.trim()
}

function effectiveTotal(l) {
  return l.finalPrice != null ? l.finalPrice : l.qty * l.unitPrice
}

function invoiceTotal(inv) {
  return (inv.lines ?? []).filter(l => l.included).reduce((s, l) => s + effectiveTotal(l), 0)
}

// ── Метадані таблиць ──────────────────────────────────────
export const TABLES = {
  ownerProfile: {
    label: 'Виконавець', ns: 'owner',
    sample: {
      fullName: 'ФОП Петренко І. І.', ipn: '0987654321',
      iban: 'UA00 0000 0000 0000 0000 0000 000', bankName: 'АТ «Банк»',
      address: 'м. Львів, вул. Січова, 5', phone: '+380 50 111 2233', email: 'owner@example.com',
    },
    fields: [
      { key: 'fullName', label: 'Назва / ПІБ' },
      { key: 'ipn',      label: 'ІПН' },
      { key: 'iban',     label: 'IBAN' },
      { key: 'bankName', label: 'Банк' },
      { key: 'address',  label: 'Адреса' },
      { key: 'phone',    label: 'Телефон' },
      { key: 'email',    label: 'Email' },
    ],
    relations: [],
  },

  groups: {
    label: 'Група клієнтів', ns: 'group', documentBase: true,
    sample: { name: 'ТОВ Ромашка', contactPerson: 'Сидоренко І. І.', contactPhone: '+380 44 123 4567' },
    fields: [
      { key: 'name',          label: 'Назва' },
      { key: 'contactPerson', label: 'Контактна особа' },
      { key: 'contactPhone',  label: 'Телефон' },
    ],
    relations: [],
    defaultBody: `## Група: {{ group.name }}

{{#if group.contactPerson}}Контактна особа: {{ group.contactPerson }}{{/if}}
{{#if group.contactPhone}}Телефон: {{ group.contactPhone }}{{/if}}`,
  },

  clients: {
    label: 'Клієнт', ns: 'client', documentBase: true,
    sample: {
      clientType: 'fop', lastName: 'Іваненко', firstName: 'Олег', middleName: 'Петрович', company: '',
      ipn: '1234567890', phone: '+380 67 000 0000', email: 'client@example.com',
      address: 'м. Київ, вул. Хрещатик, 1', groupId: 1,
    },
    fields: [
      { key: 'name',    label: 'Назва / ПІБ', get: r => clientName(r) },
      { key: 'company', label: 'Компанія' },
      { key: 'ipn',     label: 'ІПН / ЄДРПОУ' },
      { key: 'phone',   label: 'Телефон' },
      { key: 'email',   label: 'Email' },
      { key: 'address', label: 'Адреса' },
    ],
    relations: [
      { field: 'groupId', target: 'groups', ns: 'group', label: 'Група' },
    ],
    defaultBody: `## Картка клієнта

**{{ client.name }}**
{{#if client.ipn}}ІПН / ЄДРПОУ: {{ client.ipn }}{{/if}}
{{#if client.phone}}Телефон: {{ client.phone }}{{/if}}
{{#if client.email}}Email: {{ client.email }}{{/if}}
{{#if client.address}}Адреса: {{ client.address }}{{/if}}`,
  },

  payments: {
    label: 'Платіж', ns: 'payment', documentBase: true,
    sample: { amount: 1500, date: Date.now(), method: 'cash', notes: 'Оплата за травень 2026', clientId: 1 },
    fields: [
      { key: 'amount', label: 'Сума',     filter: 'money' },
      { key: 'date',   label: 'Дата',     filter: 'date' },
      { key: 'method', label: 'Метод' },
      { key: 'notes',  label: 'Примітка' },
    ],
    relations: [
      { field: 'clientId', target: 'clients', ns: 'client', label: 'Клієнт' },
    ],
    defaultBody: `# КВИТАНЦІЯ

**Отримано від:** {{ client.name }}
**Сума:** {{ payment.amount | money }}
**Дата:** {{ payment.date | date }}
Метод оплати: {{ payment.method }}
{{#if payment.notes}}*Призначення: {{ payment.notes }}*{{/if}}`,
  },

  invoices: {
    label: 'Рахунок', ns: 'invoice', documentBase: true, hasLines: true,
    sample: {
      number: '0001', period: '2026-05', createdAt: Date.now(), notes: 'Дякуємо за співпрацю.', clientId: 1,
      lines: [
        { name: 'Ведення обліку ФОП (3 група)', qty: 1, unitPrice: 1200, finalPrice: null, included: true },
        { name: 'Звіт ЄСВ', qty: 1, unitPrice: 300, finalPrice: null, included: true },
      ],
    },
    fields: [
      { key: 'number', label: 'Номер' },
      { key: 'date',   label: 'Дата',     filter: 'date', get: r => r.date ?? r.createdAt ?? '' },
      { key: 'period', label: 'Період',   get: r => periodLabel(r.period) },
      { key: 'total',  label: 'Сума',     filter: 'money', get: r => invoiceTotal(r) },
      { key: 'notes',  label: 'Примітки' },
    ],
    relations: [
      { field: 'clientId', target: 'clients', ns: 'client', label: 'Клієнт' },
      { global: true, target: 'ownerProfile', ns: 'owner', label: 'Виконавець' },
    ],
    defaultBody: INVOICE_DEFAULT_BODY,
  },
}

// ── Генерація блоку тегів зі схеми ────────────────────────
function fieldToken(ns, f) {
  const filter = f.filter ? ` | ${f.filter}` : ''
  return { token: `{{ ${ns}.${f.key}${filter} }}`, label: f.label }
}

function groupFor(ns, label, table) {
  return { label, tokens: table.fields.map(f => fieldToken(ns, f)) }
}

// Базова таблиця + всі таблиці, на які вона посилається (один рівень).
export function buildTokenGroups(baseKey) {
  const base = TABLES[baseKey]
  if (!base) return []

  const baseGroup = groupFor(base.ns, base.label, base)
  if (base.hasLines) baseGroup.tokens.push({ token: '{{ table.lines }}', label: 'Таблиця позицій' })

  const groups = [baseGroup]
  for (const rel of base.relations ?? []) {
    const target = TABLES[rel.target]
    if (target) groups.push(groupFor(rel.ns, rel.label ?? target.label, target))
  }
  return groups
}

// ── Контекст для прев'ю (йде по звʼязках, бере sample кожної таблиці) ──
function mapFields(table, record) {
  const out = {}
  for (const f of table.fields) {
    out[f.key] = f.get ? f.get(record) : (record?.[f.key] ?? '')
  }
  return out
}

function buildLines(rec) {
  return (rec.lines ?? []).filter(l => l.included).map((l, i) => ({
    number: i + 1,
    name: l.name ?? '',
    qty: l.qty,
    unitPrice: l.unitPrice,
    total: effectiveTotal(l),
  }))
}

// Спільна збірка контексту: getRecord(tableName) → запис для цієї таблиці.
function assembleContext(baseKey, getRecord) {
  const base = TABLES[baseKey]
  if (!base) return {}

  const baseRec = getRecord(baseKey) ?? {}
  const ctx = { [base.ns]: mapFields(base, baseRec) }

  for (const rel of base.relations ?? []) {
    const target = TABLES[rel.target]
    if (!target) continue
    ctx[rel.ns] = mapFields(target, getRecord(rel.target) ?? {})
  }

  if (base.hasLines) ctx.lines = buildLines(baseRec)
  return ctx
}

// Контекст для прев'ю: sample кожної таблиці (overrides — замінити, напр. owner).
export function buildSampleContext(baseKey, overrides = {}) {
  return assembleContext(baseKey, name => overrides[name] ?? TABLES[name]?.sample)
}

// Контекст із реальних даних: recordsByTable = { tableName: record }.
// Для базової таблиці з hasLines масив позицій передається у baseRecord.lines.
export function buildContext(baseKey, recordsByTable = {}) {
  return assembleContext(baseKey, name => recordsByTable[name])
}

export const DOCUMENT_BASES = Object.keys(TABLES).filter(k => TABLES[k].documentBase)
