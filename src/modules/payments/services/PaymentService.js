import { db } from '@/db/index.js'

export const PaymentService = {

  async createPaymentWithInvoices(data, invoiceIds = []) {
    return db.transaction('rw', db.payments, db.paymentInvoices, db.invoices, async () => {
      const paymentId = await db.payments.add({
        clientId:  data.clientId,
        amount:    data.amount,
        date:      data.date,
        method:    data.method,
        notes:     data.notes ?? '',
        createdAt: Date.now(),
      })
      if (invoiceIds.length > 0) {
        await db.paymentInvoices.bulkAdd(
          invoiceIds.map(invoiceId => ({ paymentId, invoiceId }))
        )
        const paidAt = Date.now()
        await db.invoices.bulkUpdate(
          invoiceIds.map(invoiceId => ({ key: invoiceId, changes: { status: 'paid', paidAt } }))
        )
      }
      return paymentId
    })
  },

  async getById(id) {
    return db.payments.get(Number(id))
  },

  async getAll() {
    return db.payments.orderBy('date').reverse().toArray()
  },

  async getByClientId(clientId) {
    const rows = await db.payments
      .where('clientId').equals(Number(clientId))
      .toArray()
    return rows.sort((a, b) => b.date - a.date)
  },

  async getPaymentsByInvoiceId(invoiceId) {
    const links = await db.paymentInvoices
      .where('invoiceId').equals(Number(invoiceId))
      .toArray()
    if (links.length === 0) return []
    const payments = await db.payments.bulkGet(links.map(l => l.paymentId))
    return payments.filter(Boolean).sort((a, b) => b.date - a.date)
  },

  async getLinkedInvoiceIds(paymentId) {
    const links = await db.paymentInvoices
      .where('paymentId').equals(Number(paymentId))
      .toArray()
    return links.map(l => l.invoiceId)
  },

  async getLinkedInvoices(paymentId) {
    const links = await db.paymentInvoices
      .where('paymentId').equals(Number(paymentId))
      .toArray()
    if (links.length === 0) return []
    const invoices = await db.invoices.bulkGet(links.map(l => l.invoiceId))
    return invoices.filter(Boolean)
  },

  async updatePayment(id, data) {
    await db.payments.update(Number(id), data)
  },

  async deletePayment(id) {
    await db.transaction('rw', db.payments, db.paymentInvoices, async () => {
      await db.paymentInvoices.where('paymentId').equals(Number(id)).delete()
      await db.payments.delete(Number(id))
    })
  },
}
