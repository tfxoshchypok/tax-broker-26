import { db } from '@/db/index.js'

const RECORD_ID = 1

export const OwnerProfileService = {
  async get() {
    return (await db.ownerProfile.get(RECORD_ID)) ?? null
  },

  async save(data) {
    await db.ownerProfile.put({ ...data, id: RECORD_ID })
  },
}
