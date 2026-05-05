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
  if (instance.submittedAt) return 'submitted'
  if (instance.contactedAt) return 'contacted'
  return 'pending'
}

export const useTaxDashboardStore = defineStore('taxDashboard', () => {
  const viewMode = ref(localStorage.getItem('mb_tax_view') || 'list')
  const categoryFilter = ref([])
  const statusFilter = ref([])

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

  const groupedByClient = computed(() => {
    const activeClients = clientsStore.list.filter(c => isClientVisibleForMonth(c, year.value, month.value))

    const groups = []
    for (const client of activeClients) {
      const profile = profilesStore.getProfile(client.id)
      if (!profile) continue

      const profileWithType = { ...profile, clientType: client.clientType }
      const expected = getExpectedReports(profileWithType, year.value, month.value, rulesStore.activeForEngine)
      if (expected.length === 0) continue

      const filtered = categoryFilter.value.length > 0
        ? expected.filter(r => categoryFilter.value.includes(r.rule.category))
        : expected

      const reports = filtered
        .filter(({ dueDate }) => dueDate >= client.createdAt)
        .map(({ rule, period, dueDate }) => {
          const instance = instances.value.find(
            i => i.clientId === client.id && i.ruleId === rule.id && i.period === period
          ) ?? null
          const status = computeStatus(instance)
          return { rule, period, dueDate, status, instance }
        })

      const matchesStatusFilter = statusFilter.value.length === 0
        || reports.some(r => statusFilter.value.includes(r.status))

      if (!matchesStatusFilter) continue

      groups.push({ client, reports })
    }

    const nowTs = Date.now()

    // Sort: overdue → active → all submitted; within each bucket — alphabetically by client name
    groups.sort((a, b) => {
      const score = (g) => {
        const hasOverdue = g.reports.some(r => r.status !== 'submitted' && r.dueDate < nowTs)
        const allSubmitted = g.reports.every(r => r.status === 'submitted')
        if (hasOverdue) return 0
        if (!allSubmitted) return 1
        return 2
      }
      const diff = score(a) - score(b)
      if (diff !== 0) return diff
      const nameOf = (g) => g.client.lastName || g.client.company || ''
      return nameOf(a).localeCompare(nameOf(b), 'uk')
    })

    return groups
  })

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

  async function resetStatus(instanceId) {
    await TaxReportService.resetStatus(instanceId)
    await loadInstances()
  }

  function setViewMode(mode) {
    viewMode.value = mode
    localStorage.setItem('mb_tax_view', mode)
  }

  return {
    year, month, viewMode, categoryFilter, statusFilter,
    groupedByClient, instances,
    refresh, markContacted, markSubmitted, updateNotes, resetStatus,
    prevMonth, nextMonth, setViewMode,
  }
})
