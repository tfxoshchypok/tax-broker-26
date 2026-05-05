import { db } from '@/db/index.js'

export const TaxReportService = {

  // ── taxProfiles ───────────────────────────────────────

  async getProfileByClientId(clientId) {
    return db.taxProfiles.where('clientId').equals(Number(clientId)).first()
  },

  async saveProfile(clientId, data) {
    const existing = await TaxReportService.getProfileByClientId(clientId)
    const now = Date.now()
    if (existing) {
      await db.taxProfiles.update(existing.id, { ...data, clientId: Number(clientId), updatedAt: now })
    } else {
      await db.taxProfiles.add({ ...data, clientId: Number(clientId), updatedAt: now })
    }
  },

  // ── taxReportInstances ────────────────────────────────

  async getInstance(clientId, ruleId, period) {
    return db.taxReportInstances
      .where('[clientId+ruleId+period]')
      .equals([Number(clientId), ruleId, period])
      .first()
  },

  async getByClientId(clientId) {
    return db.taxReportInstances.where('clientId').equals(Number(clientId)).toArray()
  },

  async getByMonth(year, month) {
    const start = new Date(year, month - 1, 1).getTime()
    const end = new Date(year, month, 0, 23, 59, 59, 999).getTime()
    return db.taxReportInstances.where('dueDate').between(start, end, true, true).toArray()
  },

  async markContacted(clientId, ruleId, period, dueDate, notes = '') {
    const existing = await TaxReportService.getInstance(clientId, ruleId, period)
    const now = Date.now()
    if (existing) {
      await db.taxReportInstances.update(existing.id, { contactedAt: now, notes, updatedAt: now })
    } else {
      await db.taxReportInstances.add({
        clientId: Number(clientId), ruleId, period, dueDate,
        contactedAt: now, submittedAt: null, notes, updatedAt: now,
      })
    }
  },

  async markSubmitted(clientId, ruleId, period, dueDate, notes = '') {
    const existing = await TaxReportService.getInstance(clientId, ruleId, period)
    const now = Date.now()
    if (existing) {
      await db.taxReportInstances.update(existing.id, {
        contactedAt: existing.contactedAt ?? now,
        submittedAt: now, notes, updatedAt: now,
      })
    } else {
      await db.taxReportInstances.add({
        clientId: Number(clientId), ruleId, period, dueDate,
        contactedAt: now, submittedAt: now, notes, updatedAt: now,
      })
    }
  },

  async updateNotes(id, notes) {
    await db.taxReportInstances.update(id, { notes, updatedAt: Date.now() })
  },

  async resetStatus(id) {
    await db.taxReportInstances.delete(id)
  },
}
