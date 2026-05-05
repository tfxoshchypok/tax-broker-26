import { db } from '@/db/index.js'

export const ReportRulesService = {
  async getAll() {
    const all = await db.reportRules.toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  },

  async create(data) {
    return db.reportRules.add(data)
  },

  async update(id, data) {
    return db.reportRules.update(Number(id), data)
  },

  async remove(id) {
    return db.reportRules.delete(Number(id))
  },
}
