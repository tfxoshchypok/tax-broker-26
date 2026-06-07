import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useClientsStore } from '@/stores/clients.js'
import { BillingService } from '../services/BillingService.js'
import { useYearMonth } from '@/composables/useYearMonth.js'

export const useBillingDashboardStore = defineStore('billingDashboard', () => {
  const statusFilter = ref([])
  const invoices = ref([])

  const clientsStore = useClientsStore()

  const { year, month, prevMonth, nextMonth } = useYearMonth(() => refresh())

  const period = computed(() =>
    `${year.value}-${String(month.value).padStart(2, '0')}`
  )

  const groupedByClient = computed(() => {
    const filtered = statusFilter.value.length > 0
      ? invoices.value.filter(inv => statusFilter.value.includes(inv.status))
      : invoices.value

    const map = {}
    for (const inv of filtered) {
      if (!map[inv.clientId]) map[inv.clientId] = []
      map[inv.clientId].push(inv)
    }

    const groups = Object.entries(map).map(([clientId, clientInvoices]) => {
      const client = clientsStore.list.find(c => c.id === Number(clientId)) ?? null
      const sorted = [...clientInvoices].sort((a, b) => {
        const order = { draft: 0, confirmed: 1, paid: 2, cancelled: 3 }
        return (order[a.status] ?? 9) - (order[b.status] ?? 9)
      })
      return { client, invoices: sorted }
    })

    groups.sort((a, b) => {
      const name = c => c?.company || `${c?.lastName} ${c?.firstName}` || ''
      return name(a.client).localeCompare(name(b.client), 'uk')
    })

    return groups
  })

  async function refresh() {
    if (clientsStore.list.length === 0) await clientsStore.fetchAll()
    const list = await BillingService.getByPeriod(period.value)

    // Тотали лише для не-чернеток: один пакетний запит позицій + групування
    // в памʼяті за invoiceId (замість N окремих читань).
    const billable = list.filter(inv => inv.status !== 'draft')
    if (billable.length > 0) {
      const lines = await BillingService.getLinesByInvoiceIds(billable.map(inv => inv.id))
      const totals = {}
      for (const l of lines) {
        if (!l.included) continue
        totals[l.invoiceId] = (totals[l.invoiceId] ?? 0) + (l.finalPrice ?? l.qty * l.unitPrice)
      }
      for (const inv of billable) inv._total = totals[inv.id] ?? 0
    }

    invoices.value = list
  }

  return { year, month, period, statusFilter, invoices, groupedByClient, refresh, prevMonth, nextMonth }
})
