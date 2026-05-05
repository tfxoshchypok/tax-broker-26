import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ReportRulesService } from '../services/ReportRulesService.js'

export const useReportRulesStore = defineStore('reportRules', () => {
  const list = ref([])

  // Returns active rules with `id` mapped to `ruleId` for engine compatibility
  const activeForEngine = computed(() =>
    list.value.filter(r => r.active).map(r => ({ ...r, id: r.ruleId }))
  )

  async function fetchAll() {
    list.value = await ReportRulesService.getAll()
  }

  async function create(data) {
    await ReportRulesService.create(data)
    await fetchAll()
  }

  async function update(id, data) {
    await ReportRulesService.update(id, data)
    await fetchAll()
  }

  async function remove(id) {
    await ReportRulesService.remove(id)
    await fetchAll()
  }

  return { list, activeForEngine, fetchAll, create, update, remove }
})
