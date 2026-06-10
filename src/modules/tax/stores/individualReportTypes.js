import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { IndividualReportTypeService } from '../services/IndividualReportTypeService.js'

export const useIndividualReportTypesStore = defineStore('individualReportTypes', () => {
  const list = ref([])

  // id → type, for resolving assignments in the engine
  const byId = computed(() => Object.fromEntries(list.value.map(t => [t.id, t])))

  // active types, for assignment pickers
  const activeList = computed(() => list.value.filter(t => t.active))

  async function fetchAll() {
    list.value = await IndividualReportTypeService.getAll()
  }

  async function create(data) {
    await IndividualReportTypeService.add(data)
    await fetchAll()
  }

  async function update(id, data) {
    await IndividualReportTypeService.update(id, data)
    await fetchAll()
  }

  async function remove(id) {
    await IndividualReportTypeService.remove(id)
    await fetchAll()
  }

  return { list, byId, activeList, fetchAll, create, update, remove }
})
