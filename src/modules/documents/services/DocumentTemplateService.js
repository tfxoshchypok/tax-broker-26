import { db } from '@/db/index.js'
import { DEFAULT_ACCENT, DEFAULT_FONT } from '../config/invoiceTokenTemplate.js'
import { ENTITIES } from '../config/entities.js'

let defaultsEnsured = false

const ukCollator = new Intl.Collator('uk')

export const DocumentTemplateService = {

  // Гарантує типовий шаблон для КОЖНОЇ сутності, якій його бракує.
  // (populate не використовуємо — працює і на свіжій БД, і після міграції,
  //  і якщо в таблиці вже є шаблони лише частини сутностей.)
  // Достатньо один раз за сесію: подальші виклики (після кожної мутації) — no-op.
  async ensureDefaults() {
    if (defaultsEnsured) return
    // Нормалізація застарілих однинних type (ранні сесії) → імена таблиць.
    const LEGACY = { invoice: 'invoices', client: 'clients', payment: 'payments', group: 'groups' }
    const rows = await db.documentTemplates.toArray()
    for (const r of rows) {
      if (LEGACY[r.type]) {
        await db.documentTemplates.update(r.id, { type: LEGACY[r.type] })
        r.type = LEGACY[r.type]
      }
    }

    const existingTypes = new Set(rows.map(t => t.type))
    const now = Date.now()
    const toAdd = ENTITIES
      .filter(e => !existingTypes.has(e.key))
      .map(e => ({
        type: e.key,
        name: `${e.label} — стандартний`,
        body: e.defaultBody,
        accentColor: DEFAULT_ACCENT,
        fontFamily: DEFAULT_FONT,
        isDefault: 1,
        createdAt: now,
        updatedAt: now,
      }))
    if (toAdd.length) await db.documentTemplates.bulkAdd(toAdd)
    defaultsEnsured = true
  },

  async getAll(type) {
    const rows = type
      ? await db.documentTemplates.where('type').equals(type).toArray()
      : await db.documentTemplates.toArray()
    return rows.sort((a, b) => ukCollator.compare(a.name || '', b.name || ''))
  },

  async getById(id) {
    return db.documentTemplates.get(Number(id))
  },

  async getDefault(type = 'invoices') {
    const rows = await db.documentTemplates.where('type').equals(type).toArray()
    return rows.find(t => t.isDefault) ?? rows[0] ?? null
  },

  async create(data = {}) {
    const now = Date.now()
    return db.documentTemplates.add({
      type: 'invoices',
      name: 'Новий шаблон',
      body: '',
      accentColor: DEFAULT_ACCENT,
      fontFamily: DEFAULT_FONT,
      isDefault: 0,
      createdAt: now,
      updatedAt: now,
      ...data,
    })
  },

  async update(id, data) {
    await db.documentTemplates.update(Number(id), { ...data, updatedAt: Date.now() })
  },

  async remove(id) {
    await db.documentTemplates.delete(Number(id))
  },

  // Робить шаблон типовим для свого типу (скидає прапор в інших того ж типу).
  async setDefault(id, type = 'invoices') {
    await db.transaction('rw', db.documentTemplates, async () => {
      const rows = await db.documentTemplates.where('type').equals(type).toArray()
      for (const t of rows) {
        await db.documentTemplates.update(t.id, { isDefault: t.id === Number(id) ? 1 : 0 })
      }
    })
  },
}
