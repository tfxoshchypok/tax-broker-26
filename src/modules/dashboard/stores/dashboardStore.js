import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useClientsStore } from '@/stores/clients.js'
import { useYearMonth } from '@/composables/useYearMonth.js'
import { DashboardService } from '../services/DashboardService.js'
import {
  revenueForPeriod, revenueForYear, monthlyRevenueSeries,
  debtByClient, overdueReports,
} from '../engine/kpiEngine.js'

export const useDashboardStore = defineStore('dashboard', () => {
  const payments = ref([])
  const billableInvoices = ref([])
  const invoiceTotals = ref(new Map())
  const reportInstances = ref([])
  const loading = ref(false)

  const clientsStore = useClientsStore()
  const { year, month, prevMonth, nextMonth } = useYearMonth(() => refresh())

  function clientName(clientId) {
    const c = clientsStore.list.find(c => c.id === clientId)
    if (!c) return '—'
    return c.clientType === 'legal' ? c.company : `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim()
  }

  // ── Дохід ───────────────────────────────────────────────
  const revenueReceived = computed(() => revenueForPeriod(payments.value, year.value, month.value))
  const revenueYear = computed(() => revenueForYear(payments.value, year.value))

  // Виставлено за період = сума білабельних рахунків, чий period збігається з вибраним.
  const revenueBilled = computed(() => {
    const period = `${year.value}-${String(month.value).padStart(2, '0')}`
    let sum = 0
    for (const inv of billableInvoices.value) {
      if (inv.period === period) sum += invoiceTotals.value.get(inv.id) ?? 0
    }
    return sum
  })

  const revenueSeries = computed(() =>
    monthlyRevenueSeries(payments.value, { year: year.value, month: month.value }, 12)
  )

  // ── Борг ────────────────────────────────────────────────
  const debtList = computed(() =>
    debtByClient(billableInvoices.value, invoiceTotals.value, payments.value)
  )
  const debtTotal = computed(() => debtList.value.reduce((s, d) => s + d.debt, 0))
  const topDebtors = computed(() =>
    debtList.value.slice(0, 5).map(d => ({ ...d, name: clientName(d.clientId) }))
  )

  // ── Лічильники ──────────────────────────────────────────
  const overdue = computed(() => overdueReports(reportInstances.value))
  const overdueCount = computed(() => overdue.value.length)
  const unpaidInvoices = computed(() => billableInvoices.value.filter(inv => inv.status === 'confirmed'))
  const unpaidCount = computed(() => unpaidInvoices.value.length)
  const leadCount = computed(() => clientsStore.statusCounts.lead)

  // ── Що зробити сьогодні ─────────────────────────────────
  // Прострочені звіти + неоплачені підтверджені рахунки.
  const todoItems = computed(() => {
    const items = []
    for (const i of overdue.value) {
      items.push({
        kind: 'report',
        id: `report-${i.id}`,
        title: clientName(i.clientId),
        subtitle: `Прострочений звіт · ${i.period}`,
        dueDate: i.dueDate,
      })
    }
    for (const inv of unpaidInvoices.value) {
      items.push({
        kind: 'invoice',
        id: `invoice-${inv.id}`,
        invoiceId: inv.id,
        title: clientName(inv.clientId),
        subtitle: `Неоплачений рахунок ${inv.number}`,
        amount: invoiceTotals.value.get(inv.id) ?? 0,
      })
    }
    return items
  })

  async function refresh() {
    loading.value = true
    try {
      if (clientsStore.list.length === 0) await clientsStore.fetchAll()
      const raw = await DashboardService.loadRaw()
      payments.value = raw.payments
      billableInvoices.value = raw.billableInvoices
      invoiceTotals.value = raw.invoiceTotals
      reportInstances.value = raw.reportInstances
    } finally {
      loading.value = false
    }
  }

  return {
    year, month, loading,
    revenueReceived, revenueBilled, revenueYear, revenueSeries,
    debtTotal, topDebtors,
    overdueCount, unpaidCount, leadCount,
    todoItems,
    refresh, prevMonth, nextMonth,
  }
})
