import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { PaymentService } from '../services/PaymentService.js'

export const usePaymentsStore = defineStore('payments', () => {
  const list      = ref([])
  const isLoading = ref(false)

  const methodFilter = ref([])   // [] = all; subset of ['cash','bank','writeoff']
  const clientFilter = ref(null) // null = all; or clientId (number)
  const dateFrom     = ref(null) // null or timestamp
  const dateTo       = ref(null) // null or timestamp

  const filtered = computed(() => {
    let result = list.value
    if (methodFilter.value.length > 0)
      result = result.filter(p => methodFilter.value.includes(p.method))
    if (clientFilter.value !== null)
      result = result.filter(p => p.clientId === clientFilter.value)
    if (dateFrom.value !== null)
      result = result.filter(p => p.date >= dateFrom.value)
    if (dateTo.value !== null)
      result = result.filter(p => p.date <= dateTo.value)
    return result
  })

  const totalAmount = computed(() =>
    filtered.value.reduce((sum, p) => sum + p.amount, 0)
  )

  async function fetchAll() {
    isLoading.value = true
    try {
      list.value = await PaymentService.getAll()
    } finally {
      isLoading.value = false
    }
  }

  const refresh = fetchAll

  function resetFilters() {
    methodFilter.value = []
    clientFilter.value = null
    dateFrom.value     = null
    dateTo.value       = null
  }

  return {
    list, filtered, totalAmount, isLoading,
    methodFilter, clientFilter, dateFrom, dateTo,
    fetchAll, refresh, resetFilters,
  }
})
