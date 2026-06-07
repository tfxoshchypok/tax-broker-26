import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useClientsStore } from '@/stores/clients.js'
import { useTaxProfilesStore } from './taxProfiles.js'
import { useReportRulesStore } from './reportRules.js'
import { TaxReportService } from '../services/TaxReportService.js'
import { getExpectedReports } from '../services/TaxReportEngine.js'
import { useYearMonth } from '@/composables/useYearMonth.js'
import { db } from '@/db/index.js'

function computeStatus(instance) {
  if (!instance) return 'pending'
  if (instance.ignoredAt) return 'ignored'
  if (instance.submittedAt) return 'submitted'
  if (instance.contactedAt) return 'contacted'
  return 'pending'
}

const ukCollator = new Intl.Collator('uk')

export const useTaxDashboardStore = defineStore('taxDashboard', () => {
  const viewMode = ref(localStorage.getItem('mb_tax_view') || 'list')
  const categoryFilter = ref([])
  const statusFilter = ref([])
  const groupFilter = ref(null)
  const nameFilter = ref('')

  const instances = ref([])

  const clientsStore = useClientsStore()
  const profilesStore = useTaxProfilesStore()
  const rulesStore = useReportRulesStore()

  const { year, month, prevMonth, nextMonth } = useYearMonth(() => refresh())

  function isClientVisibleForMonth(client, y, m) {
    if (client.status === 'active') return true
    if (client.status === 'inactive' && client.archivedAt) {
      const d = new Date(client.archivedAt)
      const ay = d.getFullYear()
      const am = d.getMonth() + 1
      return y < ay || (y === ay && m < am)
    }
    return false
  }

  function clientMatchesName(client, query) {
    if (!query) return true
    const haystack = [client.company, client.lastName, client.firstName]
      .filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(query)
  }

  // Індекс інстансів: ключ `clientId|ruleId|period` → instance.
  // Будується один раз на зміну instances, замінює лінійний .find() у циклі.
  // Складений індекс [clientId+ruleId+period] у БД не унікальний, тож за наявності
  // дублікатів зберігаємо ПЕРШИЙ запис — тотожно до поведінки колишнього .find().
  const instanceIndex = computed(() => {
    const map = new Map()
    for (const i of instances.value) {
      const key = `${i.clientId}|${i.ruleId}|${i.period}`
      if (!map.has(key)) map.set(key, i)
    }
    return map
  })

  // Важкий розрахунок податкового движка. Залежить лише від клієнтів, профілів,
  // правил, року та місяця — НЕ від фільтрів. Тому набір тексту в пошуку чи
  // перемикання фільтрів не запускає движок наново.
  const expectedByClient = computed(() => {
    const result = []
    for (const client of clientsStore.list) {
      if (!isClientVisibleForMonth(client, year.value, month.value)) continue

      const profile = profilesStore.getProfile(client.id)
      if (!profile) continue

      const profileWithType = { ...profile, clientType: client.clientType }
      const expected = getExpectedReports(profileWithType, year.value, month.value, rulesStore.activeForEngine)
      if (expected.length === 0) continue

      result.push({ client, expected })
    }
    return result
  })

  const groupedByClient = computed(() => {
    const nameQuery = nameFilter.value.trim().toLowerCase()
    const index = instanceIndex.value
    const groups = []

    for (const { client, expected } of expectedByClient.value) {
      if (groupFilter.value != null && client.groupId !== groupFilter.value) continue
      if (!clientMatchesName(client, nameQuery)) continue

      const filtered = categoryFilter.value.length > 0
        ? expected.filter(r => categoryFilter.value.includes(r.rule.category))
        : expected

      const reports = filtered
        .filter(({ dueDate }) => dueDate >= client.createdAt)
        .map(({ rule, period, dueDate, submissionStart }) => {
          const instance = index.get(`${client.id}|${rule.id}|${period}`) ?? null
          const status = computeStatus(instance)
          return { rule, period, dueDate, submissionStart, status, instance }
        })

      // Прибрати клієнтів, у яких після фільтрів не лишилося жодного звіту
      if (reports.length === 0) continue

      const matchesStatusFilter = statusFilter.value.length === 0
        || reports.some(r => statusFilter.value.includes(r.status))

      if (!matchesStatusFilter) continue

      groups.push({ client, reports })
    }

    const nowTs = Date.now()

    // Sort: overdue → active → all done; within each bucket — alphabetically by client name
    groups.sort((a, b) => {
      const score = (g) => {
        const hasOverdue = g.reports.some(r => r.status !== 'submitted' && r.status !== 'ignored' && r.dueDate < nowTs)
        const allDone = g.reports.every(r => r.status === 'submitted' || r.status === 'ignored')
        if (hasOverdue) return 0
        if (!allDone) return 1
        return 2
      }
      const diff = score(a) - score(b)
      if (diff !== 0) return diff
      const nameOf = (g) => g.client.lastName || g.client.company || ''
      return ukCollator.compare(nameOf(a), nameOf(b))
    })

    return groups
  })

  const hasActiveFilters = computed(() =>
    nameFilter.value.trim() !== '' ||
    categoryFilter.value.length > 0 ||
    statusFilter.value.length > 0 ||
    groupFilter.value != null
  )

  function resetFilters() {
    nameFilter.value = ''
    categoryFilter.value = []
    statusFilter.value = []
    groupFilter.value = null
  }

  async function loadInstances() {
    const relevantIds = clientsStore.list
      .filter(c => c.status === 'active' || c.status === 'inactive')
      .map(c => c.id)
    instances.value = await db.taxReportInstances
      .where('clientId').anyOf(relevantIds)
      .toArray()
  }

  async function refresh() {
    if (clientsStore.list.length === 0) await clientsStore.fetchAll()
    const relevantClients = clientsStore.list.filter(c => c.status === 'active' || c.status === 'inactive')
    await Promise.all([
      ...relevantClients.map(c => profilesStore.load(c.id)),
      rulesStore.list.length === 0 ? rulesStore.fetchAll() : Promise.resolve(),
    ])
    await loadInstances()
  }

  async function markContacted(clientId, ruleId, period, dueDate) {
    await TaxReportService.markContacted(clientId, ruleId, period, dueDate)
    await loadInstances()
  }

  async function markSubmitted(clientId, ruleId, period, dueDate) {
    await TaxReportService.markSubmitted(clientId, ruleId, period, dueDate)
    await loadInstances()
  }

  async function updateNotes(instanceId, notes) {
    await TaxReportService.updateNotes(instanceId, notes)
    await loadInstances()
  }

  async function markIgnored(clientId, ruleId, period, dueDate) {
    await TaxReportService.markIgnored(clientId, ruleId, period, dueDate)
    await loadInstances()
  }

  async function resetStatus(instanceId) {
    await TaxReportService.resetStatus(instanceId)
    await loadInstances()
  }

  function setViewMode(mode) {
    viewMode.value = mode
    localStorage.setItem('mb_tax_view', mode)
  }

  return {
    year, month, viewMode, categoryFilter, statusFilter, groupFilter, nameFilter,
    hasActiveFilters, groupedByClient, instances,
    refresh, markContacted, markSubmitted, markIgnored, updateNotes, resetStatus,
    resetFilters, prevMonth, nextMonth, setViewMode,
  }
})
