<template>
  <div class="view-container">
    <n-page-header title="Платежі">
      <template #extra>
        <n-button type="primary" size="small" @click="showNewModal = true">
          <template #icon><n-icon><AddOutline /></n-icon></template>
          Новий платіж
        </n-button>
      </template>
    </n-page-header>

    <div class="toolbar" style="margin-top: 16px;">
      <n-select
        v-model:value="store.clientFilter"
        :options="clientOptions"
        clearable
        filterable
        placeholder="Всі клієнти"
        style="width: 200px;"
      />
      <n-select
        v-model:value="methodSelectValue"
        :options="methodOptions"
        clearable
        placeholder="Всі методи"
        style="width: 160px;"
        @update:value="onMethodFilter"
      />
      <n-date-picker
        v-model:value="dateRange"
        type="daterange"
        clearable
        style="width: 260px;"
        @update:value="onDateRange"
      />
      <n-button v-if="hasFilters" text @click="store.resetFilters(); dateRange = null; methodSelectValue = null">
        Скинути
      </n-button>
    </div>

    <div class="summary" style="margin-top: 12px; margin-bottom: 4px;">
      <span style="font-size: 13px; opacity: 0.6;">Разом:&nbsp;</span>
      <span style="font-weight: 700; font-size: 16px;">{{ formatPrice(store.totalAmount) }}</span>
      <span style="font-size: 13px; opacity: 0.5; margin-left: 8px;">({{ store.filtered.length }} платежів)</span>
    </div>

    <n-spin :show="store.isLoading" style="margin-top: 12px;">
      <n-empty
        v-if="!store.isLoading && store.filtered.length === 0"
        description="Платежів немає"
        style="margin-top: 60px;"
      >
        <template #extra>
          <n-button @click="showNewModal = true">Зареєструвати платіж</n-button>
        </template>
      </n-empty>

      <n-data-table
        v-else
        :columns="columns"
        :data="store.filtered"
        :row-props="rowProps"
        :bordered="false"
        style="cursor: pointer;"
      />
    </n-spin>

    <RegisterPaymentModal
      v-model:show="showNewModal"
      :pre-invoice="null"
      @registered="onPaymentSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NPageHeader, NButton, NIcon, NSpin, NEmpty, NSelect, NDatePicker,
  NDataTable, useMessage,
} from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { useClientsStore } from '@/stores/clients.js'
import { usePaymentsStore } from '../stores/paymentsStore.js'
import PaymentMethodBadge from '../components/PaymentMethodBadge.vue'
import RegisterPaymentModal from '../components/RegisterPaymentModal.vue'

const router       = useRouter()
const store        = usePaymentsStore()
const clientsStore = useClientsStore()
const message      = useMessage()

const showNewModal     = ref(false)
const dateRange        = ref(null)
const methodSelectValue = ref(null)

const methodOptions = [
  { label: 'Готівка',    value: 'cash' },
  { label: 'Безготівка', value: 'bank' },
  { label: 'Списання',   value: 'writeoff' },
]

const clientOptions = computed(() =>
  clientsStore.list.map(c => ({
    label: c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}`,
    value: c.id,
  }))
)

const hasFilters = computed(() =>
  store.clientFilter !== null ||
  store.methodFilter.length > 0 ||
  store.dateFrom !== null ||
  store.dateTo !== null
)

function onMethodFilter(val) {
  store.methodFilter = val ? [val] : []
}

function onDateRange(val) {
  if (!val) {
    store.dateFrom = null
    store.dateTo   = null
  } else {
    store.dateFrom = val[0]
    store.dateTo   = val[1] + 86399999
  }
}

function clientName(clientId) {
  const c = clientsStore.list.find(c => c.id === clientId)
  if (!c) return '—'
  return c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}`
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}

const columns = [
  {
    title: 'Дата',
    key: 'date',
    width: 120,
    render: row => formatDate(row.date),
  },
  {
    title: 'Клієнт',
    key: 'clientId',
    render: row => h(
      'span',
      {
        style: 'color: inherit;',
        onClick: (e) => { e.stopPropagation(); router.push({ name: 'client-detail', params: { id: row.clientId } }) },
      },
      clientName(row.clientId)
    ),
  },
  {
    title: 'Метод',
    key: 'method',
    width: 130,
    render: row => h(PaymentMethodBadge, { method: row.method }),
  },
  {
    title: 'Сума',
    key: 'amount',
    width: 130,
    render: row => h('span', { style: 'font-weight: 600;' }, formatPrice(row.amount)),
  },
  {
    title: 'Примітка',
    key: 'notes',
    render: row => h('span', { style: 'opacity: 0.6; font-size: 13px;' }, row.notes || ''),
  },
]

function rowProps(row) {
  return {
    onClick: () => router.push({ name: 'payment-detail', params: { id: row.id } }),
  }
}

async function onPaymentSaved() {
  await store.refresh()
  message.success('Платіж зареєстровано')
}

onMounted(async () => {
  if (clientsStore.list.length === 0) await clientsStore.fetchAll()
  await store.fetchAll()
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 900px;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}

.summary {
  display: flex;
  align-items: baseline;
}
</style>
