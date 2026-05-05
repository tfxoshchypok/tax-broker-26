import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BillingService } from '../services/BillingService.js'

export const useServiceRatesStore = defineStore('serviceRates', () => {
  const rates = ref([])
  const historyByRateId = ref({})

  const ratesMap = computed(() => {
    const map = {}
    for (const r of rates.value) map[r.ruleId ?? `custom_${r.id}`] = r
    return map
  })

  async function load() {
    rates.value = await BillingService.getAllRates()
  }

  async function save(id, data) {
    await BillingService.saveRate(id, data)
    await load()
  }

  async function add(data) {
    await BillingService.addRate(data)
    await load()
  }

  async function remove(id) {
    await BillingService.deleteRate(id)
    await load()
  }

  async function loadHistory(rateId) {
    historyByRateId.value[rateId] = await BillingService.getHistoryByRateId(rateId)
  }

  return { rates, historyByRateId, ratesMap, load, save, add, remove, loadHistory }
})
