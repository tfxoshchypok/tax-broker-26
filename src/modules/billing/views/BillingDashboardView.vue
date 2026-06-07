<template>
  <div class="view-container">
    <n-page-header title="Рахунки">
      <template #extra>
        <n-space>
          <n-button size="small" @click="$router.push({ name: 'billing-rates' })">Прайс-лист</n-button>
          <n-button type="primary" size="small" @click="openNewModal">
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
          <n-button @click="openNewModal">Створити рахунок</n-button>
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
              <template v-if="inv.status !== 'draft'">{{ inv._total != null ? formatPrice(inv._total) : '—' }}</template>
              <template v-else>чернетка</template>
            </span>
            <div v-if="inv.status === 'confirmed' || inv.status === 'paid'" class="inv-actions" @click.stop>
              <template v-if="inv.status === 'confirmed'">
                <n-button size="small" type="success" @click="markPaid(inv)">
                  <template #icon><n-icon><CashOutline /></n-icon></template>
                  Оплатити
                </n-button>
              </template>
              <template v-else>
                <n-button size="small" @click="viewPayment(inv)">
                  <template #icon><n-icon><EyeOutline /></n-icon></template>
                  Переглянути оплату
                </n-button>
                <n-button size="small" type="error" ghost @click="cancelPayment(inv)">
                  <template #icon><n-icon><ArrowUndoOutline /></n-icon></template>
                  Скасувати оплату
                </n-button>
              </template>
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
        <n-form-item label="Дата рахунку">
          <n-date-picker
            v-model:value="newForm.dateTs"
            type="date"
            style="width: 100%;"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showNewModal = false">Скасувати</n-button>
        <n-button
          type="primary"
          :disabled="!newForm.clientId || !newForm.dateTs"
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
  useMessage, useDialog,
} from 'naive-ui'
import {
  AddOutline, ChevronBackOutline, ChevronForwardOutline,
  CashOutline, EyeOutline, ArrowUndoOutline,
} from '@vicons/ionicons5'
import { useClientsStore } from '@/stores/clients.js'
import { useBillingDashboardStore } from '../stores/billingDashboard.js'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts.js'
import { BillingService } from '../services/BillingService.js'
import { PaymentService } from '@/modules/payments/services/PaymentService.js'
import InvoiceStatusBadge from '../components/InvoiceStatusBadge.vue'
import RegisterPaymentModal from '@/modules/payments/components/RegisterPaymentModal.vue'

const router = useRouter()
const store = useBillingDashboardStore()
const clientsStore = useClientsStore()
const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const showNewModal      = ref(false)
const showPaymentModal  = ref(false)
const payingInvoice     = ref(null)
const newForm = ref({ clientId: null, dateTs: Date.now() })

function openNewModal() {
  newForm.value = { clientId: null, dateTs: Date.now() }
  showNewModal.value = true
}

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

async function viewPayment(inv) {
  const payments = await PaymentService.getPaymentsByInvoiceId(inv.id)
  if (payments.length === 0) {
    message.warning('Платіж не знайдено')
    return
  }
  router.push({ name: 'payment-detail', params: { id: payments[0].id } })
}

function cancelPayment(inv) {
  dialog.warning({
    title: 'Скасувати оплату?',
    content: 'Повʼязаний платіж буде видалено, а рахунок повернеться до статусу «Підтверджено».',
    positiveText: 'Скасувати оплату',
    negativeText: 'Назад',
    async onPositiveClick() {
      await BillingService.cancelPayment(inv.id)
      await store.refresh()
      message.info('Оплату скасовано')
    },
  })
}

async function onPaymentRegistered() {
  await store.refresh()
  message.success('Рахунок оплачено')
}

function goToNew() {
  if (!newForm.value.clientId || !newForm.value.dateTs) return
  showNewModal.value = false
  router.push({
    name: 'billing-new',
    query: { clientId: newForm.value.clientId, date: newForm.value.dateTs },
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
  gap: 8px;
  flex-shrink: 0;
}
</style>
