import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { GroupService } from '@/services/GroupService.js'
import { useClientsStore } from '@/stores/clients.js'

export const useGroupsStore = defineStore('groups', () => {
  const list = ref([])

  const asOptions = computed(() =>
    list.value.map(g => ({ label: g.name, value: g.id }))
  )

  async function fetchAll() {
    list.value = await GroupService.getAll()
  }

  async function create(data) {
    const id = await GroupService.create(data)
    await fetchAll()
    return id
  }

  async function update(id, data) {
    await GroupService.update(id, data)
    await fetchAll()
  }

  async function remove(id) {
    await GroupService.remove(id)
    await fetchAll()
    // GroupService.remove clears groupId on affected clients in DB — sync the in-memory list
    await useClientsStore().fetchAll()
  }

  return { list, asOptions, fetchAll, create, update, remove }
})
