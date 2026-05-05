import { db } from '@/db/index.js'

db.version(6).stores({
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
  paymentInvoices:    '++id, paymentId, invoiceId',
})

db.version(7).stores({
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
})
