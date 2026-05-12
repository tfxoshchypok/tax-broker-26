import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db } from '@/db/index.js'
import { PaymentService } from '@/modules/payments/services/PaymentService.js'

const CLIENT_ID = 1
const paymentData = {
  clientId: CLIENT_ID,
  amount: 2500,
  date: new Date(2025, 1, 20).getTime(),
  method: 'bank',
  notes: '',
}

async function addInvoice(status = 'confirmed') {
  return db.invoices.add({
    clientId: CLIENT_ID,
    period: '2025-02',
    number: '2025-02-001',
    status,
    createdAt: Date.now(),
  })
}

beforeAll(async () => {
  await db.open()
})

afterAll(() => {
  db.close()
})

beforeEach(async () => {
  await db.payments.clear()
  await db.paymentInvoices.clear()
  await db.invoices.clear()
})

describe('PaymentService', () => {
  describe('createPaymentWithInvoices', () => {
    it('returns a numeric paymentId and persists the payment row', async () => {
      const paymentId = await PaymentService.createPaymentWithInvoices(paymentData)
      expect(typeof paymentId).toBe('number')
      const saved = await db.payments.get(paymentId)
      expect(saved.amount).toBe(2500)
      expect(saved.method).toBe('bank')
    })

    it('creates a paymentInvoices link for each invoiceId', async () => {
      const inv1 = await addInvoice()
      const inv2 = await addInvoice()
      const paymentId = await PaymentService.createPaymentWithInvoices(paymentData, [inv1, inv2])
      const links = await db.paymentInvoices.where('paymentId').equals(paymentId).toArray()
      expect(links).toHaveLength(2)
      expect(links.map(l => l.invoiceId).sort()).toEqual([inv1, inv2].sort())
    })

    it('marks linked invoices as paid', async () => {
      const invId = await addInvoice('confirmed')
      await PaymentService.createPaymentWithInvoices(paymentData, [invId])
      const invoice = await db.invoices.get(invId)
      expect(invoice.status).toBe('paid')
      expect(invoice.paidAt).toBeTypeOf('number')
    })

    it('creates no links and leaves invoices unchanged when invoiceIds is empty', async () => {
      const invId = await addInvoice('confirmed')
      const paymentId = await PaymentService.createPaymentWithInvoices(paymentData, [])
      const links = await db.paymentInvoices.where('paymentId').equals(paymentId).toArray()
      expect(links).toHaveLength(0)
      const invoice = await db.invoices.get(invId)
      expect(invoice.status).toBe('confirmed')
    })
  })

  describe('deletePayment', () => {
    it('removes the payment row and all its paymentInvoices links', async () => {
      const invId = await addInvoice()
      const paymentId = await PaymentService.createPaymentWithInvoices(paymentData, [invId])

      await PaymentService.deletePayment(paymentId)

      expect(await db.payments.get(paymentId)).toBeUndefined()
      const links = await db.paymentInvoices.where('paymentId').equals(paymentId).toArray()
      expect(links).toHaveLength(0)
    })
  })
})
