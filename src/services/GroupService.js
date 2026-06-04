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

  // Перезаписує склад групи: знімає groupId з тих, кого прибрали, і
  // призначає його обраним (перезаписуючи попередню групу — клієнт у одній групі).
  async setMembers(groupId, clientIds) {
    const gid = Number(groupId)
    const memberIds = clientIds.map(Number)
    const memberSet = new Set(memberIds)
    const now = Date.now()
    await db.transaction('rw', db.clients, async () => {
      const current = await db.clients.where('groupId').equals(gid).toArray()
      const toRemove = current.filter(c => !memberSet.has(c.id)).map(c => c.id)
      if (toRemove.length) {
        await db.clients.where('id').anyOf(toRemove).modify({ groupId: null, updatedAt: now })
      }
      if (memberIds.length) {
        await db.clients.where('id').anyOf(memberIds).modify({ groupId: gid, updatedAt: now })
      }
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
