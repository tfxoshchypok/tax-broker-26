import { db } from '@/db/index.js'

// Версія 13: додаємо таблицю шаблонів документів.
// Повторюємо повну схему v12 (із src/db/index.js) + documentTemplates.
// `isDefault` зберігається як 1/0 (Dexie погано індексує boolean), тож не індексуємо.
db.version(13).stores({
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
  documentTemplates:  '++id, type, name',
})

// Dev-валідатор схеми: попереджає в консолі про дрейф dataSchema ↔ БД.
if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') {
  db.on('ready', () => {
    import('./config/schemaValidator.js').then(({ validateDataSchema }) => {
      const { errors, hints } = validateDataSchema(db)
      errors.forEach(e => console.error('[dataSchema]', e))
      hints.forEach(h => console.warn('[dataSchema]', h))
    })
  })
}
