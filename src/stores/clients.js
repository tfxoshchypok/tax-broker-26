import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { db } from '@/db/index.js'
import { useUiStore } from '@/stores/ui.js'

export const useClientsStore = defineStore('clients', () => {
  const ui = useUiStore()
  const list = ref([])
  const searchQuery = ref('')
  const statusFilter = ref('active')
  const tagFilter = ref([])
  const groupFilter = ref(null)
  const isLoading = ref(false)
  const currentPage = ref(1)

  const statusCounts = computed(() => {
    const counts = { lead: 0, active: 0, inactive: 0 }
    list.value.forEach(c => { if (c.status in counts) counts[c.status]++ })
    return counts
  })

  const filtered = computed(() => {
    const q = searchQuery.value.toLowerCase().trim()
    return list.value.filter(c => {
      const matchesSearch = !q || [c.firstName, c.lastName, c.email, c.phone, c.company, c.ipn]
        .some(v => v?.toLowerCase().includes(q))
      const matchesStatus = !statusFilter.value || c.status === statusFilter.value
      const matchesTags = tagFilter.value.length === 0 ||
        tagFilter.value.every(tid => c.tagIds?.includes(tid))
      const matchesGroup = groupFilter.value == null || c.groupId === groupFilter.value
      return matchesSearch && matchesStatus && matchesTags && matchesGroup
    })
  })

  const paginated = computed(() => {
    const start = (currentPage.value - 1) * ui.defaultPageSize
    return filtered.value.slice(start, start + ui.defaultPageSize)
  })

  watch([searchQuery, statusFilter, tagFilter, groupFilter], () => { currentPage.value = 1 })

  async function fetchAll() {
    isLoading.value = true
    try {
      const [allClients, allClientTags] = await Promise.all([
        db.clients.orderBy('lastName').toArray(),
        db.clientTags.toArray(),
      ])
      const tagMap = {}
      allClientTags.forEach(ct => {
        if (!tagMap[ct.clientId]) tagMap[ct.clientId] = []
        tagMap[ct.clientId].push(ct.tagId)
      })
      list.value = allClients.map(c => ({ ...c, tagIds: tagMap[c.id] ?? [] }))
    } finally {
      isLoading.value = false
    }
  }

  async function getById(id) {
    return db.clients.get(Number(id))
  }

  async function create(data) {
    const now = Date.now()
    const id = await db.clients.add({ ...data, createdAt: now, updatedAt: now })
    await fetchAll()
    return id
  }

  async function update(id, data) {
    const updates = { ...data, updatedAt: Date.now() }
    if ('status' in data) {
      if (data.status === 'inactive') {
        const current = await db.clients.get(Number(id))
        if (current.status !== 'inactive') updates.archivedAt = Date.now()
      } else {
        updates.archivedAt = null
      }
    }
    await db.clients.update(Number(id), updates)
    await fetchAll()
  }

  async function remove(id) {
    await db.transaction('rw', db.clients, db.interactions, db.clientTags, async () => {
      await db.interactions.where('clientId').equals(Number(id)).delete()
      await db.clientTags.where('clientId').equals(Number(id)).delete()
      await db.clients.delete(Number(id))
    })
    await fetchAll()
  }

  return {
    list, filtered, paginated, searchQuery, statusFilter, tagFilter, groupFilter,
    statusCounts, isLoading, currentPage,
    fetchAll, getById, create, update, remove,
  }
})
