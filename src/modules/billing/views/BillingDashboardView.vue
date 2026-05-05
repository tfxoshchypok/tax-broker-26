<template>
  <div class="view-container">
    <n-page-header title="Рахунки">
      <template #extra>
        <n-space>
          <n-button size="small" @click="$router.push({ name: 'billing-rates' })">Прайс-лист</n-button>
          <n-button type="primary" size="small" @click="showNewModal = true">
            <template #icon><n-icon><AddOutline /></n-icon></template>
            Новий рахунок
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <div class="toolbar" style="margin-top: 16px;">
      <div class="month-nav">
        <n-button text @click="store.prevMonth()">
          <template #icon><n-icon><ChevronBackOutline /></n-icon></template>
        </n-button>
        <span class="month-label" :class="{ 'month-label--current': isCurrentMonth }">{{ monthLabel }}</span>
        <n-button text @click="store.nextMonth()">
          <template #icon><n-icon><ChevronForwardOutline /></n-icon></template>
        </n-button>
      </div>

      <n-checkbox-group v-model:value="store.statusFilter" style="margin-left: 16px;">
        <n-space size="small">
          <n-checkbox value="draft">Чернетка</n-checkbox>
          <n-checkbox value="confirmed">Підтверджено</n-checkbox>
          <n-checkbox value="paid">Оплачено</n-checkbox>
          <n-checkbox value="cancelled">Скасовано</n-checkbox>
        </n-space>
      </n-checkbox-group>
    </div>

    <n-spin :show="loading" style="margin-top: 20px;">
      <n-empty
        v-if="!loading && store.groupedByClient.length === 0"
        description="Рахунків за цей місяць немає"
        style="margin-top: 60px;"
      >
        <template #extra>
          <n-button @click="showNewModal = true">Створити рахунок</n-button>
        </template>
      </n-empty>

      <div v-else class="groups">
        <div v-for="group in store.groupedByClient" :key="group.client?.id" class="group">
          <div class="group-header">
            <n-button
              text
              tag="a"
              @click="$router.push({ name: 'client-detail', params: { id: group.client?.id } })"
            >
              {{ clientName(group.client) }}
            </n-button>
            <span class="group-count">{{ group.invoices.length }} рах.</span>
          </div>

          <div
            v-for="inv in group.invoices"
            :key="inv.id"
            class="invoice-row"
            @click="$router.push({ name: 'billing-invoice', params: { id: inv.id } })"
          >
            <InvoiceStatusBadge :status="inv.status" />
            <span class="inv-number">{{ inv.number }}</span>
            <span class="inv-period">{{ formatPeriod(inv.period) }}</span>
            <span class="inv-amount">
              <template v-if="inv.status !== 'draft'">{{ inv._total ? formatPrice(inv._total) : '—' }}</template>
              <template v-else>чернетка</template>
            </span>
            <div v-if="inv.status === 'confirmed'" class="inv-actions" @click.stop>
              <n-button size="small" type="success" @click="markPaid(inv)">Оплачено ✓</n-button>
            </div>
          </div>
        </div>
      </div>
    </n-spin>

    <RegisterPaymentModal
      v-model:show="showPaymentModal"
      :pre-invoice="payingInvoice"
      @registered="onPaymentRegistered"
    />

    <!-- New invoice modal: pick client + period -->
    <n-modal v-model:show="showNewModal" title="Новий рахунок" preset="dialog" :show-icon="false">
      <n-form :model="newForm" style="margin-top: 8px;">
        <n-form-item label="Клієнт">
          <n-select
            v-model:value="newForm.clientId"
            :options="clientOptions"
            filterable
            placeholder="Оберіть клієнта"
          />
        </n-form-item>
        <n-form-item label="Місяць">
          <n-date-picker
            v-model:value="newForm.periodTs"
            type="month"
            style="width: 100%;"
            :value-format="'yyyy-MM'"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showNewModal = false">Скасувати</n-button>
        <n-button
          type="primary"
          :disabled="!newForm.clientId || !newForm.periodTs"
          @click="goToNew"
        >Далі</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NPageHeader, NButton, NIcon, NSpin, NEmpty, NSpace,
  NCheckbox, NCheckboxGroup, NModal, NForm, NFormItem, NSelect, NDatePicker,
  useMessage,
} from 'naive-ui'
import { AddOutline, ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { useClientsStore } from '@/stores/clients.js'
import { useBillingDashboardStore } from '../stores/billingDashboard.js'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts.js'
import InvoiceStatusBadge from '../components/InvoiceStatusBadge.vue'
import RegisterPaymentModal from '@/modules/payments/components/RegisterPaymentModal.vue'

const router = useRouter()
const store = useBillingDashboardStore()
const clientsStore = useClientsStore()
const message = useMessage()
const loading = ref(false)
const showNewModal      = ref(false)
const showPaymentModal  = ref(false)
const payingInvoice     = ref(null)
const newForm = ref({ clientId: null, periodTs: null })

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']
const monthLabel = computed(() => `${UA_MONTHS[store.month - 1]} ${store.year}`)

const todayYear  = new Date().getFullYear()
const todayMonth = new Date().getMonth() + 1
const isCurrentMonth = computed(() => store.year === todayYear && store.month === todayMonth)

const clientOptions = computed(() =>
  clientsStore.list
    .filter(c => c.status === 'active')
    .map(c => ({ label: clientName(c), value: c.id }))
)

function clientName(c) {
  if (!c) return '—'
  return c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}`
}

function formatPeriod(period) {
  const [y, m] = period.split('-')
  return `${UA_MONTHS[Number(m) - 1]} ${y}`
}

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}

function markPaid(inv) {
  payingInvoice.value = inv
  showPaymentModal.value = true
}

async function onPaymentRegistered() {
  await store.refresh()
  message.success('Рахунок оплачено')
}

function goToNew() {
  if (!newForm.value.clientId || !newForm.value.periodTs) return
  showNewModal.value = false
  router.push({
    name: 'billing-new',
    query: { clientId: newForm.value.clientId, period: newForm.value.periodTs },
  })
}

useKeyboardShortcuts({
  arrowleft:  () => store.prevMonth(),
  arrowright: () => store.nextMonth(),
})

onMounted(async () => {
  loading.value = true
  if (clientsStore.list.length === 0) await clientsStore.fetchAll()
  await store.refresh()
  loading.value = false
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
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
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

.groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group {
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 8px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(128, 128, 128, 0.04);
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
  font-weight: 600;
  font-size: 14px;
}

.group-count {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.5;
}

.invoice-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.invoice-row:hover {
  background: rgba(128, 128, 128, 0.06);
}

.inv-number {
  font-family: monospace;
  font-size: 13px;
  min-width: 100px;
}

.inv-period {
  font-size: 13px;
  opacity: 0.6;
  min-width: 100px;
}

.inv-amount {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  text-align: right;
}

.inv-actions {
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}
</style>
