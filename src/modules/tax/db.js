import { db } from '@/db/index.js'
import { DEFAULT_REPORT_RULES } from './config/defaultReportRules.js'
import { DEFAULT_SPECIAL_TAX_TYPES } from './config/defaultSpecialTaxTypes.js'

db.version(2).stores({
  clients:            '++id, lastName, email, phone, company, status, clientType, createdAt',
  interactions:       '++id, clientId, type, date',
  tags:               '++id, &name',
  clientTags:         '++id, clientId, tagId',
  taxProfiles:        '++id, &clientId',
  taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]',
})

db.version(3).stores({
  clients:            '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt',
  interactions:       '++id, clientId, type, date',
  tags:               '++id, &name',
  clientTags:         '++id, clientId, tagId',
  taxProfiles:        '++id, &clientId',
  taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]',
})

db.version(8).stores({
  clients:            '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt',
  interactions:       '++id, clientId, type, date',
  tags:               '++id, &name',
  clientTags:         '++id, clientId, tagId',
  taxProfiles:        '++id, &clientId',
  taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]',
  serviceRates:       '++id, ruleId, active',
  serviceRateHistory: '++id, rateId, changedAt',
  invoices:           '++id, clientId, period, number, status, createdAt',
  invoiceLines:       '++id, invoiceId, instanceId, ruleId, type, sortOrder',
  ownerProfile:       '++id',
  payments:           '++id, clientId, date, method, createdAt',
  paymentInvoices:    '++id, paymentId, invoiceId, &[paymentId+invoiceId]',
  reportRules:        '++id, &ruleId, category, active',
}).upgrade(tx => {
  return tx.table('reportRules').bulkAdd(DEFAULT_REPORT_RULES)
})

// Seeding for fresh installs (upgrade() runs only on migration, not on first-ever DB creation)
db.on('populate', async tx => {
  await tx.table('specialTaxTypes').bulkAdd(DEFAULT_SPECIAL_TAX_TYPES)
  await tx.table('reportRules').bulkAdd(DEFAULT_REPORT_RULES)
})

db.version(10).stores({
  clients:            '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt',
  interactions:       '++id, clientId, type, date',
  tags:               '++id, &name',
  clientTags:         '++id, clientId, tagId',
  taxProfiles:        '++id, &clientId',
  taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]',
  serviceRates:       '++id, ruleId, active',
  serviceRateHistory: '++id, rateId, changedAt',
  invoices:           '++id, clientId, period, number, status, createdAt',
  invoiceLines:       '++id, invoiceId, instanceId, ruleId, type, sortOrder',
  ownerProfile:       '++id',
  payments:           '++id, clientId, date, method, createdAt',
  paymentInvoices:    '++id, paymentId, invoiceId, &[paymentId+invoiceId]',
  reportRules:        '++id, &ruleId, category, active',
}).upgrade(async tx => {
  const CATEGORY_MAP = {
    unified_tax:   'income',
    vat:           'vat_excise',
    income_tax:    'income',
    employees:     'esv',
    excise:        'vat_excise',
    land:          'local',
    environmental: 'resource',
  }
  await tx.table('reportRules').toCollection().modify(rule => {
    if (CATEGORY_MAP[rule.category]) rule.category = CATEGORY_MAP[rule.category]
  })
})

db.version(9).stores({
  clients:            '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt',
  interactions:       '++id, clientId, type, date',
  tags:               '++id, &name',
  clientTags:         '++id, clientId, tagId',
  taxProfiles:        '++id, &clientId',
  taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]',
  serviceRates:       '++id, ruleId, active',
  serviceRateHistory: '++id, rateId, changedAt',
  invoices:           '++id, clientId, period, number, status, createdAt',
  invoiceLines:       '++id, invoiceId, instanceId, ruleId, type, sortOrder',
  ownerProfile:       '++id',
  payments:           '++id, clientId, date, method, createdAt',
  paymentInvoices:    '++id, paymentId, invoiceId, &[paymentId+invoiceId]',
  reportRules:        '++id, &ruleId, category, active',
}).upgrade(async tx => {
  await tx.table('reportRules').where('ruleId').equals('unified_report_q').delete()
  await tx.table('reportRules').bulkAdd([
    {
      ruleId: 'unified_report_legal_monthly',
      name: "Об'єднана звітність (ЄСВ + 4-ДФ) — юридичні",
      shortName: 'ЄСВ+4ДФ юр.',
      category: 'employees',
      frequency: 'monthly',
      deadline: { type: 'day_of_next_month', day: 20 },
      condition: { taxSystem: null, simplifiedGroup: null, clientType: 'legal', vatPayer: null, hasEmployees: true, exciseTax: null, landTax: null, environmentalTax: null, rentTax: null },
      active: true,
    },
    {
      ruleId: 'unified_report_fop_quarterly',
      name: "Об'єднана звітність (ЄСВ + 4-ДФ) — ФОП",
      shortName: 'ЄСВ+4ДФ ФОП',
      category: 'employees',
      frequency: 'quarterly',
      deadline: { type: 'days_after_period_end', value: 40 },
      condition: { taxSystem: null, simplifiedGroup: null, clientType: 'fop', vatPayer: null, hasEmployees: true, exciseTax: null, landTax: null, environmentalTax: null, rentTax: null },
      active: true,
    },
  ])
})

const FULL_SCHEMA_V11 = {
  clients:            '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt',
  interactions:       '++id, clientId, type, date',
  tags:               '++id, &name',
  clientTags:         '++id, clientId, tagId',
  taxProfiles:        '++id, &clientId',
  taxReportInstances: '++id, clientId, ruleId, period, dueDate, status, [clientId+ruleId+period]',
  serviceRates:       '++id, ruleId, active',
  serviceRateHistory: '++id, rateId, changedAt',
  invoices:           '++id, clientId, period, number, status, createdAt',
  invoiceLines:       '++id, invoiceId, instanceId, ruleId, type, sortOrder',
  ownerProfile:       '++id',
  payments:           '++id, clientId, date, method, createdAt',
  paymentInvoices:    '++id, paymentId, invoiceId, &[paymentId+invoiceId]',
  reportRules:        '++id, &ruleId, category, active',
  specialTaxTypes:    '++id, &key, active',
}

const OLD_FLAG_TO_KEY = {
  exciseTax:        'excise_tax',
  landTax:          'land_tax',
  environmentalTax: 'environmental_tax',
  rentTax:          'rent_tax',
}

db.version(11).stores(FULL_SCHEMA_V11).upgrade(async tx => {
  // 1. Seed built-in special tax types
  await tx.table('specialTaxTypes').bulkAdd(DEFAULT_SPECIAL_TAX_TYPES)

  // 2. Migrate taxProfiles: boolean flags → specialTaxes[]
  await tx.table('taxProfiles').toCollection().modify(profile => {
    const specialTaxes = []
    for (const [field, key] of Object.entries(OLD_FLAG_TO_KEY)) {
      if (profile[field]) specialTaxes.push(key)
      profile[field] = undefined
    }
    profile.specialTaxes = specialTaxes
  })

  // 3. Migrate reportRules conditions: boolean flags → requiredSpecialTaxes[]
  await tx.table('reportRules').toCollection().modify(rule => {
    if (!rule.condition) return
    const req = []
    for (const [field, key] of Object.entries(OLD_FLAG_TO_KEY)) {
      if (rule.condition[field]) req.push(key)
      rule.condition[field] = undefined
    }
    if (req.length > 0) rule.condition.requiredSpecialTaxes = req
  })
})

// Individual reports — types with manual per-client schedules (e.g. quarterly
// excise licence instalments). Types live in `individualReportTypes`; per-client
// assignments (personal deadline anchor + lead window) live in `individualReports`.
// Status tracking reuses taxReportInstances (ruleId = type.key).
db.version(15).stores({
  individualReportTypes: '++id, &key, active',
  individualReports:     '++id, clientId, typeId',
})
