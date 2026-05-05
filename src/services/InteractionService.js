import { db } from '@/db/index.js'

export const InteractionService = {
  async getByClientId(clientId) {
    const rows = await db.interactions
      .where('clientId').equals(Number(clientId))
      .toArray()
    return rows.sort((a, b) => b.date - a.date)
  },

  async create(data) {
    const now = Date.now()
    return db.interactions.add({ ...data, clientId: Number(data.clientId), createdAt: now })
  },

  async update(id, data) {
    return db.interactions.update(Number(id), data)
  },

  async remove(id) {
    return db.interactions.delete(Number(id))
  },
}
