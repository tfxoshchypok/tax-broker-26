import { db } from '@/db/index.js'
import { PaymentService } from '@/modules/payments/services/PaymentService.js'
import { BillingService } from '@/modules/billing/services/BillingService.js'

// Агрегатор сирих даних для дашборду. Лише I/O, без розрахунків —
// обчислення живуть у engine/kpiEngine.js. Перевикористовує існуючі сервіси.
export const DashboardService = {

  async loadRaw() {
    const [payments, billableInvoices, reportInstances] = await Promise.all([
      PaymentService.getAll(),
      db.invoices.where('status').anyOf(['confirmed', 'paid']).toArray(),
      db.taxReportInstances.toArray(),
    ])

    // Суми рахунків одним пакетним запитом позицій (без N+1) — та сама формула,
    // що в billingDashboard.js: included ? (finalPrice ?? qty*unitPrice).
    const invoiceTotals = new Map()
    if (billableInvoices.length > 0) {
      const lines = await BillingService.getLinesByInvoiceIds(billableInvoices.map(inv => inv.id))
      for (const l of lines) {
        if (!l.included) continue
        const amount = l.finalPrice ?? l.qty * l.unitPrice
        invoiceTotals.set(l.invoiceId, (invoiceTotals.get(l.invoiceId) ?? 0) + amount)
      }
    }

    return { payments, billableInvoices, invoiceTotals, reportInstances }
  },
}
