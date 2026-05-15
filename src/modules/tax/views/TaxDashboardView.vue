<template>
  <div class="view-container">
    <n-page-header title="Звіти">
      <template #extra>
        <div class="month-nav">
          <n-button text @click="store.prevMonth()">
            <template #icon><n-icon><ChevronBackOutline /></n-icon></template>
          </n-button>
          <span class="month-label" :class="{ 'month-label--current': isCurrentMonth }">{{ monthLabel }}</span>
          <n-button text @click="store.nextMonth()">
            <template #icon><n-icon><ChevronForwardOutline /></n-icon></template>
          </n-button>
        </div>
      </template>
    </n-page-header>

    <!-- Filters -->
    <div class="filters" style="margin-top: 16px;">
      <n-space wrap>
        <n-checkbox-group v-model:value="store.categoryFilter">
          <n-space size="small">
            <n-checkbox v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </n-checkbox>
          </n-space>
        </n-checkbox-group>

        <n-divider vertical style="height: 20px;" />

        <n-checkbox-group v-model:value="store.statusFilter">
          <n-space size="small">
            <n-checkbox value="pending">Очікується</n-checkbox>
            <n-checkbox value="contacted">Повідомлено</n-checkbox>
            <n-checkbox value="submitted">Здано</n-checkbox>
            <n-checkbox value="ignored">Ігноровано</n-checkbox>
          </n-space>
        </n-checkbox-group>

        <n-divider vertical style="height: 20px;" />

        <!-- View mode -->
        <n-button-group>
          <n-button
            :type="store.viewMode === 'list' ? 'primary' : 'default'"
            size="small"
            @click="store.setViewMode('list')"
          >
            <template #icon><n-icon><ListOutline /></n-icon></template>
          </n-button>
          <n-button
            :type="store.viewMode === 'card' ? 'primary' : 'default'"
            size="small"
            @click="store.setViewMode('card')"
          >
            <template #icon><n-icon><GridOutline /></n-icon></template>
          </n-button>
        </n-button-group>
      </n-space>
    </div>

    <!-- Content -->
    <n-spin :show="loading" style="margin-top: 24px;">
      <n-empty
        v-if="!loading && store.groupedByClient.length === 0"
        description="Немає звітів за цей місяць"
        style="margin-top: 60px;"
      >
        <template #extra>
          <n-button @click="$router.push({ name: 'clients' })">До списку клієнтів</n-button>
        </template>
      </n-empty>

      <div v-else class="groups">
        <TaxDashboardClientGroup
          v-for="group in store.groupedByClient"
          :key="group.client.id"
          :group="group"
          :view-mode="store.viewMode"
          :invoice="invoicesByClientId[group.client.id] ?? null"
          @contact-client="onContactClient"
          @submit="onSubmit"
          @reset="onReset"
          @ignore="onIgnore"
          @notes="onNotes"
          @create-invoice="onCreateInvoice"
        />
      </div>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NPageHeader, NButton, NButtonGroup, NIcon, NSpin, NEmpty,
  NSpace, NCheckbox, NCheckboxGroup, NDivider,
} from 'naive-ui'
import {
  ChevronBackOutline, ChevronForwardOutline,
  ListOutline, GridOutline,
} from '@vicons/ionicons5'
import { useTaxDashboardStore } from '../stores/taxDashboard.js'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts.js'
import { BillingService } from '@/modules/billing/services/BillingService.js'
import TaxDashboardClientGroup from '../components/TaxDashboardClientGroup.vue'

const router = useRouter()
const store = useTaxDashboardStore()
const loading = ref(false)

const invoicesByClientId = ref({})

const currentPeriod = computed(() =>
  `${store.year}-${String(store.month).padStart(2, '0')}`
)

async function loadInvoices() {
  const list = await BillingService.getByPeriod(currentPeriod.value)
  const map = {}
  for (const inv of list) map[inv.clientId] = inv
  invoicesByClientId.value = map
}

watch(currentPeriod, loadInvoices)

const CATEGORIES = [
  { value: 'income',     label: 'Прибуток' },
  { value: 'vat_excise', label: 'ПДВ+акциз' },
  { value: 'local',      label: 'Місцеві' },
  { value: 'resource',   label: 'Ресурсні' },
  { value: 'rent',       label: 'Рентні' },
  { value: 'financial',  label: 'Фінзвітність' },
  { value: 'esv',        label: 'ЄСВ' },
  { value: 'other',      label: 'Інші' },
]

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']
const monthLabel = computed(() => `${UA_MONTHS[store.month - 1]} ${store.year}`)

const todayYear  = new Date().getFullYear()
const todayMonth = new Date().getMonth() + 1
const isCurrentMonth = computed(() => store.year === todayYear && store.month === todayMonth)

useKeyboardShortcuts({
  'arrowleft': () => store.prevMonth(),
  'arrowright': () => store.nextMonth(),
})

async function onContactClient({ client, reports }) {
  await Promise.all(
    reports.map(r => store.markContacted(client.id, r.rule.id, r.period, r.dueDate))
  )
}

async function onSubmit({ client, report }) {
  await store.markSubmitted(client.id, report.rule.id, report.period, report.dueDate)
}

async function onReset(report) {
  if (report.instance?.id) await store.resetStatus(report.instance.id)
}

async function onIgnore({ client, report }) {
  await store.markIgnored(client.id, report.rule.id, report.period, report.dueDate)
}

async function onNotes({ report, notes }) {
  if (report.instance?.id) await store.updateNotes(report.instance.id, notes)
}

function onCreateInvoice({ client }) {
  router.push({
    name: 'billing-new',
    query: { clientId: client.id, period: currentPeriod.value },
  })
}

onMounted(async () => {
  loading.value = true
  await Promise.all([store.refresh(), loadInvoices()])
  loading.value = false
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 960px;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.month-label {
  font-size: 15px;
  font-weight: 500;
  min-width: 140px;
  text-align: center;
}

.month-label--current {
  color: #18a058;
  font-weight: 600;
}

.filters {
  padding: 12px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
