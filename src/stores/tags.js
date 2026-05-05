import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TagService } from '@/services/TagService.js'

export const useTagsStore = defineStore('tags', () => {
  const list = ref([])

  const asOptions = computed(() =>
    list.value.map(t => ({ label: t.name, value: t.id, color: t.color }))
  )

  async function fetchAll() {
    list.value = await TagService.getAll()
  }

  async function create(name, color) {
    const id = await TagService.create(name, color)
    await fetchAll()
    return id
  }

  async function update(id, name, color) {
    await TagService.update(id, name, color)
    await fetchAll()
  }

  async function remove(id) {
    await TagService.remove(id)
    await fetchAll()
  }

  return { list, asOptions, fetchAll, create, update, remove }
})
