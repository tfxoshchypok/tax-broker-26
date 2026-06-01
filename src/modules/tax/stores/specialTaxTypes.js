import { defineStore } from 'pinia'
import { ref } from 'vue'
import { SpecialTaxTypesService } from '../services/SpecialTaxTypesService.js'

export const useSpecialTaxTypesStore = defineStore('specialTaxTypes', () => {
  const list = ref([])

  async function fetchAll() {
    list.value = await SpecialTaxTypesService.getAll()
  }

  async function create(data) {
    await SpecialTaxTypesService.add(data)
    await fetchAll()
  }

  async function update(id, data) {
    await SpecialTaxTypesService.update(id, data)
    await fetchAll()
  }

  async function remove(id) {
    await SpecialTaxTypesService.remove(id)
    await fetchAll()
  }

  return { list, fetchAll, create, update, remove }
})
