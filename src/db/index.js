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

// Одноразова міграція: перший рядок нотаток → поле ipn, із вилученням його з
// нотаток. Мутує переданий запис (семантика Dexie .modify). Переносить лише
// якщо перший рядок — рівно стільки цифр, скільки очікує тип клієнта
// (юрособа — 8 цифр ЄДРПОУ, фіз/ФОП — 10 цифр ІПН/РНОКПП). Пропускає клієнтів,
// у яких ipn уже заповнено або немає нотаток. Експортується для юніт-тестів.
export function migrateNotesFirstLineToIpn(c) {
  if (c.ipn || !c.notes) return
  const lines = String(c.notes).split('\n')
  const first = lines[0].trim()
  const len = c.clientType === 'legal' ? 8 : 10
  if (!new RegExp(`^\\d{${len}}$`).test(first)) return
  c.ipn = first
  c.notes = lines.slice(1).join('\n').trim()
}

// v14: додаємо індекс `ipn` до clients (v13 належить модулю documents).
// Вказуємо лише змінену таблицю — решту Dexie успадкує з попередньої версії.
// upgrade виконується рівно один раз — при апгрейді наявної БД на v14.
//
// ⚠️ ЗАЛЕЖНІСТЬ ПОРЯДКУ ЗАВАНТАЖЕННЯ: цей модуль (база) завантажується РАНІШЕ
// за `@/modules/documents/db.js`, який оголошує v13 із таблицею documentTemplates.
// Dexie сортує версії за номером при .open(), тож v14 коректно успадкує
// documentTemplates з v13 — АЛЕ лише за умови, що всі модулі *db.js зареєстрували
// свої версії ДО першого звернення до БД. Зараз так і є: перший доступ — у
// onMounted в'юх, а main.js / tests/setup.js імпортують усі *db.js на старті.
// Не додавай eager-запитів до db при імпорті цього файлу — інакше v14
// відкриється без таблиці documentTemplates.
db.version(14).stores({
  clients: '++id, lastName, email, phone, company, status, clientType, createdAt, archivedAt, groupId, ipn',
}).upgrade(tx => tx.table('clients').toCollection().modify(migrateNotesFirstLineToIpn))

export const { clients, interactions, tags, clientTags } = db
