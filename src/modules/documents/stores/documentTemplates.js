import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DocumentTemplateService } from '../services/DocumentTemplateService.js'

export const useDocumentTemplatesStore = defineStore('documentTemplates', () => {
  const list = ref([])

  // type не передаємо → вантажимо всі сутності (для сторінки-списку).
  async function fetchAll(type) {
    await DocumentTemplateService.ensureDefaults()
    list.value = await DocumentTemplateService.getAll(type)
  }

  async function create(data) {
    const id = await DocumentTemplateService.create(data)
    await fetchAll()
    return id
  }

  async function update(id, data) {
    await DocumentTemplateService.update(id, data)
    await fetchAll()
  }

  async function remove(id) {
    await DocumentTemplateService.remove(id)
    await fetchAll()
  }

  async function setDefault(id, type = 'invoices') {
    await DocumentTemplateService.setDefault(id, type)
    await fetchAll()
  }

  return { list, fetchAll, create, update, remove, setDefault }
})
