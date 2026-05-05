import { db } from '@/db/index.js'

export const TagService = {
  async getAll() {
    return db.tags.toArray()
  },

  async create(name, color) {
    return db.tags.add({ name, color })
  },

  async update(id, name, color) {
    return db.tags.update(Number(id), { name, color })
  },

  async getClientCounts() {
    const links = await db.clientTags.toArray()
    return links.reduce((acc, l) => {
      acc[l.tagId] = (acc[l.tagId] ?? 0) + 1
      return acc
    }, {})
  },

  async remove(id) {
    await db.transaction('rw', db.tags, db.clientTags, async () => {
      await db.clientTags.where('tagId').equals(Number(id)).delete()
      await db.tags.delete(Number(id))
    })
  },

  async setClientTags(clientId, tagIds) {
    await db.transaction('rw', db.clientTags, async () => {
      await db.clientTags.where('clientId').equals(Number(clientId)).delete()
      await db.clientTags.bulkAdd(
        tagIds.map(tagId => ({ clientId: Number(clientId), tagId: Number(tagId) }))
      )
    })
  },
}
