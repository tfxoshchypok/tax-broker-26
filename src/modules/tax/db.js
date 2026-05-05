import { db } from '@/db/index.js'
import { DEFAULT_REPORT_RULES } from './config/defaultReportRules.js'

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
