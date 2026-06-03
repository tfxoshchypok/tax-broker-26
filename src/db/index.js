import Dexie from 'dexie'

export const db = new Dexie('MiniBuh')

db.version(1).stores({
  clients:      '++id, lastName, email, phone, company, status, clientType, createdAt',
  interactions: '++id, clientId, type, date',
  tags:         '++id, &name',
  clientTags:   '++id, clientId, tagId',
})

db.version(12).stores({
  clients:            '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt, groupId',
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
  groups:             '++id, name',
})

export const { clients, interactions, tags, clientTags } = db
