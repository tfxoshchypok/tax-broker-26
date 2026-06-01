import { db } from '@/db/index.js'

export const SpecialTaxTypesService = {
  getAll: () => db.specialTaxTypes.orderBy('id').toArray(),

  add: (data) => db.specialTaxTypes.add(data),

  update: (id, data) => db.specialTaxTypes.update(id, data),

  async isReferenced(key) {
    const inProfiles = await db.taxProfiles
      .filter(p => Array.isArray(p.specialTaxes) && p.specialTaxes.includes(key))
      .count()
    if (inProfiles > 0) return true
    const inRules = await db.reportRules
      .filter(r => Array.isArray(r.condition?.requiredSpecialTaxes) && r.condition.requiredSpecialTaxes.includes(key))
      .count()
    return inRules > 0
  },

  remove: (id) => db.specialTaxTypes.delete(id),
}
