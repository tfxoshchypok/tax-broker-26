import { db } from '@/db/index.js'

export const BillingService = {

  // ── serviceRates ─────────────────────────────────────

  async getAllRates() {
    return db.serviceRates.toArray()
  },

  async getActiveRates() {
    return db.serviceRates.where('active').equals(true).toArray()
  },

  async getAutoRates() {
    return db.serviceRates.where('active').equals(true).filter(r => r.autoInclude).toArray()
  },

  async saveRate(id, data) {
    const current = await db.serviceRates.get(id)
    if (!current) return
    const fields = ['name', 'price', 'active', 'autoInclude']
    const changedFields = fields.filter(f => data[f] !== current[f])
    if (changedFields.length === 0) return
    await db.serviceRateHistory.add({
      rateId: id,
      snapshot: { name: current.name, price: current.price, active: current.active, autoInclude: current.autoInclude },
      changedFields,
      changedAt: Date.now(),
    })
    await db.serviceRates.update(id, { ...data, updatedAt: Date.now() })
  },

  async addRate(data) {
    return db.serviceRates.add({ ...data, ruleId: null, updatedAt: Date.now() })
  },

  async deleteRate(id) {
    const rate = await db.serviceRates.get(id)
    if (rate?.ruleId !== null && rate?.ruleId !== undefined) return
    await db.serviceRateHistory.where('rateId').equals(id).delete()
    await db.serviceRates.delete(id)
  },

  // ── serviceRateHistory ────────────────────────────────

  async getHistoryByRateId(rateId) {
    const rows = await db.serviceRateHistory
      .where('rateId').equals(rateId)
      .toArray()
    return rows.sort((a, b) => b.changedAt - a.changedAt)
  },

  async getRecentHistory(limit = 20) {
    return db.serviceRateHistory.orderBy('changedAt').reverse().limit(limit).toArray()
  },

  // ── invoices ──────────────────────────────────────────

  async getByPeriod(period) {
    return db.invoices.where('period').equals(period).toArray()
  },

  async getByClientId(clientId) {
    return db.invoices.where('clientId').equals(Number(clientId)).toArray()
  },

  async getById(id) {
    return db.invoices.get(Number(id))
  },

  async generateNumber(period) {
    const count = await db.invoices.where('period').equals(period).count()
    return `${period}-${String(count + 1).padStart(3, '0')}`
  },

  async createInvoice(data) {
    const number = await BillingService.generateNumber(data.period)
    const now = Date.now()
    return db.invoices.add({
      ...data,
      number,
      status: data.status ?? 'draft',
      paymentType: data.paymentType ?? 'cash',
      notes: data.notes ?? '',
      createdAt: now,
      confirmedAt: null,
      paidAt: null,
    })
  },

  async updatePaymentType(id, paymentType) {
    await db.invoices.update(Number(id), { paymentType })
  },

  async confirmInvoice(id) {
    await db.invoices.update(Number(id), { status: 'confirmed', confirmedAt: Date.now() })
  },

  async markPaid(id) {
    await db.invoices.update(Number(id), { status: 'paid', paidAt: Date.now() })
  },

  async cancelInvoice(id) {
    await db.invoices.update(Number(id), { status: 'cancelled' })
  },

  async revertToDraft(id) {
    await db.invoices.update(Number(id), { status: 'draft', confirmedAt: null })
  },

  async revertToConfirmed(id) {
    await db.invoices.update(Number(id), { status: 'confirmed', paidAt: null })
  },

  async updateNotes(id, notes) {
    await db.invoices.update(Number(id), { notes })
  },

  // ── invoiceLines ──────────────────────────────────────

  async getLinesByInvoiceId(invoiceId) {
    return db.invoiceLines
      .where('invoiceId').equals(Number(invoiceId))
      .sortBy('sortOrder')
  },

  async bulkCreateLines(lines) {
    return db.invoiceLines.bulkAdd(lines)
  },

  async updateLine(id, data) {
    await db.invoiceLines.update(Number(id), data)
  },

  async addLine(data) {
    return db.invoiceLines.add(data)
  },

  async deleteLine(id) {
    await db.invoiceLines.delete(Number(id))
  },

  async deleteLinesByInvoiceId(invoiceId) {
    await db.invoiceLines.where('invoiceId').equals(Number(invoiceId)).delete()
  },
}
