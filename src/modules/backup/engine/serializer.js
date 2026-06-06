// Чисті функції побудови та валідації конверта бекапу.
// Без доступу до db чи файлової системи — лише трансформації над об'єктами.
import { BACKUP_FORMAT_VERSION } from '../config/backupSchema.js'

export const APP_ID = 'mini-buh'

// Збирає конверт бекапу з мапи { tableName: rows[] }.
export function buildEnvelope({ data, dbVersion = null, appVersion = null }) {
  return {
    app: APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    dbVersion,
    appVersion,
    exportedAt: Date.now(),
    data,
  }
}

// Кидає зрозумілу помилку, якщо конверт не схожий на бекап Mini BUH.
export function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope))
    throw new Error('Файл порожній або пошкоджений')
  if (envelope.app !== APP_ID)
    throw new Error('Це не файл бекапу Mini BUH')
  if (typeof envelope.formatVersion !== 'number')
    throw new Error('Невідома версія формату бекапу')
  if (envelope.formatVersion > BACKUP_FORMAT_VERSION)
    throw new Error(`Бекап створено новішою версією застосунку (формат v${envelope.formatVersion})`)
  if (!envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data))
    throw new Error('Бекап не містить даних')
  return true
}

// Сумарна кількість записів у конверті (для відображення в UI).
export function countRecords(envelope) {
  if (!envelope?.data) return 0
  return Object.values(envelope.data)
    .reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
}
