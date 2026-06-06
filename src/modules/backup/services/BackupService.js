import { db } from '@/db/index.js'
import { getCurrentVersionSync } from '@/services/UpdaterService.js'
import { BACKUP_EXCLUDE } from '../config/backupSchema.js'
import { buildEnvelope, validateEnvelope } from '../engine/serializer.js'

// Перелік таблиць для бекапу — динамічно зі схеми Dexie, мінус виключення.
// Нова таблиця в будь-якому модулі потрапляє сюди автоматично.
export function backupTableNames() {
  return db.tables.map(t => t.name).filter(n => !BACKUP_EXCLUDE.includes(n))
}

export const BackupService = {
  backupTableNames,

  // Читає всі таблиці одним read-транзакшеном і повертає конверт бекапу.
  async exportAll() {
    const tables = backupTableNames()
    const data = await db.transaction('r', db.tables, async () => {
      const out = {}
      for (const name of tables) out[name] = await db.table(name).toArray()
      return out
    })
    return buildEnvelope({ data, dbVersion: db.verno, appVersion: getCurrentVersionSync() })
  },

  // Повна заміна: очищає й заливає кожну таблицю поточної схеми (атомарно).
  // Таблиці у файлі, яких уже нема в схемі, ігноруються (повертаються у dropped).
  async importReplace(envelope) {
    validateEnvelope(envelope)
    const current = backupTableNames()
    const dropped = Object.keys(envelope.data).filter(n => !current.includes(n))
    await db.transaction('rw', db.tables, async () => {
      for (const name of current) {
        await db.table(name).clear()
        const rows = envelope.data[name]
        if (Array.isArray(rows) && rows.length) await db.table(name).bulkAdd(rows)
      }
    })
    return { dropped }
  },

  // Злиття: upsert за первинним ключем (оновлює існуючі id, додає нові).
  async importMerge(envelope) {
    validateEnvelope(envelope)
    const current = backupTableNames()
    const dropped = Object.keys(envelope.data).filter(n => !current.includes(n))
    await db.transaction('rw', db.tables, async () => {
      for (const name of current) {
        const rows = envelope.data[name]
        if (Array.isArray(rows) && rows.length) await db.table(name).bulkPut(rows)
      }
    })
    return { dropped }
  },
}
