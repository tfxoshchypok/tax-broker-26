<template>
  <div class="client-group" :class="{ 'client-group--overdue': hasOverdue }">
    <div class="group-header" @click="toggle">
      <div class="group-title">
        <n-icon size="16" style="cursor: pointer;">
          <ChevronDownOutline v-if="expanded" />
          <ChevronForwardOutline v-else />
        </n-icon>
        <router-link :to="{ name: 'client-detail', params: { id: group.client.id } }" class="client-link" @click.stop>
          {{ clientTitle }}
        </router-link>
        <span v-if="group.client.phone" class="client-phone">{{ group.client.phone }}</span>
        <n-tag type="info" size="small">{{ clientTypeLabel }}</n-tag>
        <n-tag v-if="hasOverdue" type="error" size="small">Прострочено</n-tag>
      </div>
      <div class="group-actions" @click.stop>
        <n-tag size="small" :bordered="false" style="background: rgba(128,128,128,0.12);">
          {{ group.reports.length }} {{ reportsWord }}
        </n-tag>

        <!-- Existing invoice info -->
        <template v-if="invoice">
          <router-link
            :to="{ name: 'billing-invoice', params: { id: invoice.id } }"
            class="invoice-link"
            @click.stop
          >
            <n-tag :type="invoiceTagType" size="small">
              {{ invoice.number }} · {{ invoiceStatusLabel }} · {{ formatDate(invoice.confirmedAt ?? invoice.createdAt) }}
            </n-tag>
          </router-link>
        </template>

        <n-button
          size="small"
          @click="$emit('create-invoice', { client: group.client })"
        >
          <template #icon><n-icon><ReceiptOutline /></n-icon></template>
          Рахунок
        </n-button>

        <n-button
          v-if="hasPending"
          size="small"
          @click="$emit('contact-client', { client: group.client, reports: pendingReports })"
        >
          Контакт
        </n-button>
      </div>
    </div>

    <div v-if="expanded" class="group-body">
      <!-- List view -->
      <template v-if="viewMode === 'list'">
        <TaxReportRow
          v-for="report in sortedReports"
          :key="report.rule.id + report.period"
          :report="report"
          @submit="$emit('submit', { client: group.client, report: $event })"
          @reset="$emit('reset', $event)"
          @ignore="$emit('ignore', { client: group.client, report: $event })"
          @notes="$emit('notes', $event)"
        />
      </template>

      <!-- Card/Grid view -->
      <div v-else class="card-grid">
        <TaxReportCard
          v-for="report in sortedReports"
          :key="report.rule.id + report.period"
          :report="report"
          @submit="$emit('submit', { client: group.client, report: $event })"
          @reset="$emit('reset', $event)"
          @ignore="$emit('ignore', { client: group.client, report: $event })"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { NTag, NIcon, NButton, NTooltip } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline, ReceiptOutline } from '@vicons/ionicons5'
import TaxReportRow from './TaxReportRow.vue'
import TaxReportCard from './TaxReportCard.vue'

const props = defineProps({
  group:    { type: Object, required: true },
  viewMode: { type: String, default: 'list' },
  invoice:  { type: Object, default: null },
})

defineEmits(['contact-client', 'submit', 'reset', 'ignore', 'notes', 'create-invoice'])

const INVOICE_STATUS = {
  draft:     { label: 'Чернетка',     type: 'default' },
  confirmed: { label: 'Підтверджено', type: 'info' },
  paid:      { label: 'Оплачено',     type: 'success' },
  cancelled: { label: 'Скасовано',    type: 'error' },
}

const invoiceStatusLabel = computed(() =>
  INVOICE_STATUS[props.invoice?.status]?.label ?? ''
)
const invoiceTagType = computed(() =>
  INVOICE_STATUS[props.invoice?.status]?.type ?? 'default'
)

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const hasPending = computed(() => props.group.reports.some(r => r.status === 'pending'))
const pendingReports = computed(() => props.group.reports.filter(r => r.status === 'pending'))


const expanded = ref(true)

function toggle() { expanded.value = !expanded.value }

const hasOverdue = computed(() =>
  props.group.reports.some(r => r.status !== 'submitted' && r.status !== 'ignored' && r.dueDate < Date.now())
)

const sortedReports = computed(() => {
  return [...props.group.reports].sort((a, b) => {
    const aOverdue = a.status !== 'submitted' && a.status !== 'ignored' && a.dueDate < Date.now()
    const bOverdue = b.status !== 'submitted' && b.status !== 'ignored' && b.dueDate < Date.now()
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    return a.dueDate - b.dueDate
  })
})

const CLIENT_TYPE_LABEL = { individual: 'Фіз.', fop: 'ФОП', legal: 'Юр.' }
const clientTypeLabel = computed(() => CLIENT_TYPE_LABEL[props.group.client.clientType] ?? 'Фіз.')

const clientTitle = computed(() => {
  const c = props.group.client
  return c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}`
})

const REPORT_WORDS = ['звіт', 'звіти', 'звітів']
function pluralize(n, words) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return words[2]
  if (mod10 === 1) return words[0]
  if (mod10 >= 2 && mod10 <= 4) return words[1]
  return words[2]
}
const reportsWord = computed(() => pluralize(props.group.reports.length, REPORT_WORDS))
</script>

<style scoped>
.client-group {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.client-group--overdue {
  border-color: #d03050;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  background: rgba(128, 128, 128, 0.04);
  transition: background 0.15s;
}

.group-header:hover {
  background: rgba(128, 128, 128, 0.08);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.client-link {
  font-weight: 600;
  text-decoration: none;
  color: inherit;
}

.client-link:hover {
  text-decoration: underline;
}

.client-phone {
  font-size: 13px;
  opacity: 0.55;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.invoice-link {
  text-decoration: none;
}

.invoice-link:hover :deep(.n-tag) {
  opacity: 0.85;
}


.group-body {
  padding: 8px 0;
  border-top: 1px solid rgba(128, 128, 128, 0.12);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  padding: 12px 16px;
}
</style>
