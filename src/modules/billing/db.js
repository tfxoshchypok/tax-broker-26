import { db } from '@/db/index.js'
import { DEFAULT_RATES } from './config/defaultRates.js'

db.version(4).stores({
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
}).upgrade(tx => {
  return tx.table('serviceRates').bulkAdd(
    DEFAULT_RATES.map(r => ({ ...r, updatedAt: Date.now() }))
  )
})

db.version(5).stores({
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
})

// Seeding for fresh installs (upgrade() runs only on migration, not on first-ever DB creation)
db.on('populate', async tx => {
  await tx.table('serviceRates').bulkAdd(
    DEFAULT_RATES.map(r => ({ ...r, updatedAt: Date.now() }))
  )
})
