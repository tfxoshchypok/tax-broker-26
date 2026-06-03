import { db } from '@/db/index.js'

export const GroupService = {
  async getAll() {
    return db.groups.orderBy('name').toArray()
  },

  async create(data) {
    return db.groups.add({ ...data, createdAt: Date.now() })
  },

  async update(id, data) {
    return db.groups.update(Number(id), data)
  },

  async remove(id) {
    await db.transaction('rw', db.groups, db.clients, async () => {
      await db.clients.where('groupId').equals(Number(id)).modify({ groupId: null })
      await db.groups.delete(Number(id))
    })
  },

  async getClientCounts() {
    const withGroup = await db.clients.where('groupId').above(0).toArray()
    return withGroup.reduce((acc, c) => {
      acc[c.groupId] = (acc[c.groupId] ?? 0) + 1
      return acc
    }, {})
  },
}
