<template>
  <div>
    <n-spin :show="loading">
      <!-- No profile yet -->
      <template v-if="!profile && !editing">
        <n-empty description="Податковий профіль не налаштовано" style="margin-top: 32px;">
          <template #extra>
            <n-button type="primary" @click="editing = true">Налаштувати</n-button>
          </template>
        </n-empty>
      </template>

      <!-- Profile summary -->
      <template v-else-if="profile && !editing">
        <div class="profile-summary">
          <n-descriptions :column="3" size="small">
            <n-descriptions-item label="Система">
              {{ systemLabel }}
            </n-descriptions-item>
            <n-descriptions-item label="ПДВ">{{ profile.vatPayer ? 'Так' : 'Ні' }}</n-descriptions-item>
            <n-descriptions-item label="Наймані">
              {{ profile.hasEmployees ? `${profile.employeeCount} ос.` : 'Ні' }}
            </n-descriptions-item>
            <n-descriptions-item v-if="specialTaxes" label="Спецподатки" :span="3">
              {{ specialTaxes }}
            </n-descriptions-item>
          </n-descriptions>
          <n-button size="small" style="margin-top: 12px;" @click="editing = true">Редагувати профіль</n-button>
        </div>
      </template>

      <!-- Edit form -->
      <template v-if="editing">
        <TaxProfileForm :profile="profile" @save="onSave" @cancel="editing = false" />
      </template>
    </n-spin>

    <!-- Reports for current month -->
    <template v-if="profile && !editing">
      <div class="sub-header">
        <span class="sub-label">Звіти</span>
        <n-button
          v-if="hasPendingReports"
          size="small"
          @click="contactAll"
        >
          Контакт
        </n-button>
        <div class="month-nav">
          <n-button text size="small" @click="prevMonth">
            <template #icon><n-icon><ChevronBackOutline /></n-icon></template>
          </n-button>
          <span class="month-label" :class="{ 'month-label--current': isCurrentMonth }">{{ monthLabel }}</span>
          <n-button text size="small" @click="nextMonth">
            <template #icon><n-icon><ChevronForwardOutline /></n-icon></template>
          </n-button>
        </div>
        <n-tooltip :disabled="!!profile">
          <template #trigger>
            <n-button
              size="small"
              :disabled="!profile"
              @click="createInvoice"
            >
              <template #icon><n-icon><ReceiptOutline /></n-icon></template>
              Рахунок
            </n-button>
          </template>
          Заповніть податковий профіль клієнта
        </n-tooltip>
      </div>

      <n-spin :show="reportsLoading">
        <n-empty v-if="reports.length === 0" description="Звітів у цьому місяці немає" />
        <div v-else class="reports-list">
          <TaxReportRow
            v-for="report in reports"
            :key="report.rule.id + report.period"
            :report="report"
            @contact="onContact(report)"
            @submit="onSubmit(report)"
            @reset="onReset(report)"
            @ignore="onIgnore($event)"
            @notes="onNotes($event)"
          />
        </div>
      </n-spin>

      <ClientIndividualReportsPanel
        :assignments="individualAssignments"
        :types="indTypesStore.list"
        @create="onCreateAssignment"
        @update="onUpdateAssignment"
        @delete="onDeleteAssignment"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { NButton, NIcon, NSpin, NEmpty, NDescriptions, NDescriptionsItem, NSpace, NTooltip } from 'naive-ui'
import { useSpecialTaxTypesStore } from '../stores/specialTaxTypes.js'
import { ChevronBackOutline, ChevronForwardOutline, ReceiptOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useClientsStore } from '@/stores/clients.js'
import { useTaxProfilesStore } from '../stores/taxProfiles.js'
import { useReportRulesStore } from '../stores/reportRules.js'
import { useIndividualReportTypesStore } from '../stores/individualReportTypes.js'
import { TaxReportService } from '../services/TaxReportService.js'
import { IndividualReportService } from '../services/IndividualReportService.js'
import { getExpectedReports } from '../services/TaxReportEngine.js'
import { getIndividualReports } from '../services/IndividualReportEngine.js'
import TaxProfileForm from '../components/TaxProfileForm.vue'
import TaxReportRow from '../components/TaxReportRow.vue'
import ClientIndividualReportsPanel from '../components/ClientIndividualReportsPanel.vue'

const props = defineProps({
  clientId:  { type: [String, Number], required: true },
  createdAt: { type: Number, default: 0 },
})

const router = useRouter()
const clientsStore = useClientsStore()
const profilesStore = useTaxProfilesStore()
const rulesStore = useReportRulesStore()
const taxTypesStore = useSpecialTaxTypesStore()
const indTypesStore = useIndividualReportTypesStore()
const loading = ref(false)
const reportsLoading = ref(false)
const editing = ref(false)

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)

const profile = computed(() => profilesStore.getProfile(props.clientId))
const instances = ref([])
const individualAssignments = ref([])

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']
const monthLabel = computed(() => `${UA_MONTHS[month.value - 1]} ${year.value}`)

const todayYear  = new Date().getFullYear()
const todayMonth = new Date().getMonth() + 1
const isCurrentMonth = computed(() => year.value === todayYear && month.value === todayMonth)

const GROUP_LABELS = { 1: 'Група 1', 2: 'Група 2', 3: 'Група 3 (5%)', '3vat': 'Група 3 (ПДВ)', 4: 'Група 4' }

const systemLabel = computed(() => {
  if (!profile.value) return ''
  if (profile.value.taxSystem === 'general') return 'Загальна'
  return `Спрощена · ${GROUP_LABELS[profile.value.simplifiedGroup] ?? ''}`
})

const specialTaxes = computed(() => {
  if (!profile.value) return ''
  const keys = profile.value.specialTaxes ?? []
  if (keys.length === 0) return ''
  const nameMap = Object.fromEntries(taxTypesStore.list.map(t => [t.key, t.name]))
  return keys.map(k => nameMap[k] ?? k).join(', ')
})

const reports = computed(() => {
  const client = clientsStore.list.find(c => c.id === Number(props.clientId))
  const profileWithType = profile.value
    ? (client ? { ...profile.value, clientType: client.clientType } : profile.value)
    : null
  const ruleResults = profileWithType
    ? getExpectedReports(profileWithType, year.value, month.value, rulesStore.activeForEngine)
    : []
  const individualResults = getIndividualReports(individualAssignments.value, indTypesStore.byId, year.value, month.value)

  return [...ruleResults, ...individualResults]
    .filter(({ dueDate }) => dueDate >= props.createdAt)
    .sort((a, b) => a.dueDate - b.dueDate)
    .map(({ rule, period, dueDate, submissionStart }) => {
      const instance = instances.value.find(
        i => i.clientId === Number(props.clientId) && i.ruleId === rule.id && i.period === period
      ) ?? null
      const status = instance?.ignoredAt ? 'ignored' : instance?.submittedAt ? 'submitted' : instance?.contactedAt ? 'contacted' : 'pending'
      return { rule, period, dueDate, submissionStart, status, instance }
    })
})

async function loadInstances() {
  reportsLoading.value = true
  instances.value = await TaxReportService.getByClientId(props.clientId)
  reportsLoading.value = false
}

async function loadAssignments() {
  individualAssignments.value = await IndividualReportService.getByClientId(props.clientId)
}

async function load() {
  loading.value = true
  if (clientsStore.list.length === 0) await clientsStore.fetchAll()
  if (rulesStore.list.length === 0) await rulesStore.fetchAll()
  if (taxTypesStore.list.length === 0) await taxTypesStore.fetchAll()
  if (indTypesStore.list.length === 0) await indTypesStore.fetchAll()
  await profilesStore.load(props.clientId)
  loading.value = false
  await Promise.all([loadInstances(), loadAssignments()])
}

async function onCreateAssignment(data) {
  await IndividualReportService.add({ ...data, clientId: props.clientId })
  await loadAssignments()
}

async function onUpdateAssignment({ id, data }) {
  await IndividualReportService.update(id, data)
  await loadAssignments()
}

async function onDeleteAssignment(id) {
  await IndividualReportService.remove(id)
  await loadAssignments()
}

async function onSave(data) {
  await profilesStore.save(props.clientId, data)
  await clientsStore.fetchAll()
  editing.value = false
}

async function onContact(report) {
  await TaxReportService.markContacted(props.clientId, report.rule.id, report.period, report.dueDate)
  await loadInstances()
}

async function onSubmit(report) {
  await TaxReportService.markSubmitted(props.clientId, report.rule.id, report.period, report.dueDate)
  await loadInstances()
}

async function onReset(report) {
  if (report.instance?.id) {
    await TaxReportService.resetStatus(report.instance.id)
    await loadInstances()
  }
}

async function onNotes({ report, notes }) {
  if (report.instance?.id) {
    await TaxReportService.updateNotes(report.instance.id, notes)
    await loadInstances()
  }
}

const hasPendingReports = computed(() => reports.value.some(r => r.status === 'pending'))

async function onIgnore(report) {
  await TaxReportService.markIgnored(props.clientId, report.rule.id, report.period, report.dueDate)
  await loadInstances()
}

async function contactAll() {
  const pending = reports.value.filter(r => r.status === 'pending')
  await Promise.all(
    pending.map(r => TaxReportService.markContacted(props.clientId, r.rule.id, r.period, r.dueDate))
  )
  await loadInstances()
}

function prevMonth() {
  if (month.value === 1) { month.value = 12; year.value-- }
  else month.value--
}

function nextMonth() {
  if (month.value === 12) { month.value = 1; year.value++ }
  else month.value++
}

function createInvoice() {
  router.push({
    name: 'billing-new',
    query: {
      clientId: props.clientId,
      period: `${year.value}-${String(month.value).padStart(2, '0')}`,
    },
  })
}

onMounted(load)
</script>

<style scoped>
.profile-summary {
  padding: 4px 0 8px;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  margin-bottom: 8px;
}

.sub-label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.month-label {
  font-size: 13px;
  min-width: 120px;
  text-align: center;
  font-weight: 500;
}

.month-label--current {
  color: #18a058;
  font-weight: 600;
}

.reports-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
