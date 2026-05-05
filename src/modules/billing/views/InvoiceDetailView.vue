<template>
  <div class="view-container">
    <n-spin :show="loading">
      <template v-if="invoice">
        <n-page-header :title="`Рахунок ${invoice.number}`" @back="goBack">
          <template #header>
            <InvoiceStatusBadge :status="invoice.status" />
          </template>
          <template #subtitle>
            <n-button
              text
              @click="$router.push({ name: 'client-detail', params: { id: invoice.clientId } })"
            >
              {{ clientName }}
            </n-button>
            · {{ periodLabel }}
            <span v-if="invoice.confirmedAt" style="margin-left: 8px; opacity: 0.55; font-size: 13px;">
              Підтверджено {{ formatDate(invoice.confirmedAt) }}
            </span>
            <span v-if="invoice.paidAt" style="margin-left: 8px; color: #18a058; font-size: 13px;">
              Оплачено {{ formatDate(invoice.paidAt) }}
            </span>
          </template>
          <template #extra>
            <n-space>
              <template v-if="invoice.status === 'draft'">
                <n-button type="primary" @click="doConfirm">Підтвердити</n-button>
              </template>
              <template v-if="invoice.status === 'confirmed'">
                <n-button @click="doRevert">Редагувати</n-button>
                <n-button type="success" @click="doPaid">Оплачено ✓</n-button>
              </template>
              <n-dropdown :options="menuOptions" @select="onMenuSelect">
                <n-button>···</n-button>
              </n-dropdown>
            </n-space>
          </template>
        </n-page-header>

        <div style="margin-top: 20px;">
          <InvoiceLineEditor
            :lines="lines"
            :readonly="invoice.status !== 'draft'"
            :rates="rates"
            @update:line="onUpdateLine"
            @add-line="addManualLine"
            @remove-line="removeLine"
            @add-from-rate="addRateLine"
          />
        </div>

        <n-form style="margin-top: 16px;">
          <n-form-item label="Тип оплати">
            <n-radio-group
              :value="invoice.paymentType ?? 'cash'"
              :disabled="invoice.status === 'paid'"
              @update:value="onPaymentTypeChange"
            >
              <n-radio-button value="cash">Готівка</n-radio-button>
              <n-radio-button value="bank">Безготівка</n-radio-button>
              <n-radio-button value="writeoff">Списання</n-radio-button>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="invoice.status === 'draft'" label="Примітка">
            <n-input
              :value="invoice.notes"
              type="textarea"
              :rows="2"
              placeholder="Коментар до рахунку..."
              @blur="e => saveNotes(e.target.value)"
            />
          </n-form-item>
        </n-form>
        <div v-if="invoice.status !== 'draft' && invoice.notes" style="margin-top: 4px; opacity: 0.65; font-size: 13px;">
          {{ invoice.notes }}
        </div>

        <template v-if="linkedPayments.length > 0">
          <n-divider style="margin: 20px 0 14px;" />
          <div style="font-size: 13px; font-weight: 600; opacity: 0.6; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
            Платежі
          </div>
          <div v-for="p in linkedPayments" :key="p.id" style="display: flex; align-items: center; gap: 12px; padding: 6px 0;">
            <span style="font-size: 13px; opacity: 0.65; min-width: 90px;">{{ formatDate(p.date) }}</span>
            <PaymentMethodBadge :method="p.method" />
            <span style="font-weight: 600; margin-left: auto;">{{ formatPrice(p.amount) }}</span>
          </div>
        </template>
      </template>
    </n-spin>

    <RegisterPaymentModal
      v-if="invoice"
      v-model:show="showPaymentModal"
      :pre-invoice="invoice"
      @registered="onPaymentRegistered"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NPageHeader, NButton, NSpace, NSpin, NForm, NFormItem, NInput, NDropdown, NIcon,
  NRadioGroup, NRadioButton, NDivider, useMessage, useDialog,
} from 'naive-ui'
import { ArrowUndoOutline, CloseCircleOutline, PrintOutline } from '@vicons/ionicons5'
import { useClientsStore } from '@/stores/clients.js'
import { BillingService } from '../services/BillingService.js'
import { PaymentService } from '@/modules/payments/services/PaymentService.js'
import InvoiceStatusBadge from '../components/InvoiceStatusBadge.vue'
import InvoiceLineEditor from '../components/InvoiceLineEditor.vue'
import RegisterPaymentModal from '@/modules/payments/components/RegisterPaymentModal.vue'
import PaymentMethodBadge from '@/modules/payments/components/PaymentMethodBadge.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const route  = useRoute()
const clientsStore = useClientsStore()
const message = useMessage()
const dialog  = useDialog()

const loading         = ref(true)
const invoice         = ref(null)
const lines           = ref([])
const rates           = ref([])
const linkedPayments  = ref([])
const showPaymentModal = ref(false)

let _lineKey = 0
function newKey() { return `new_${++_lineKey}` }

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

const client = computed(() =>
  clientsStore.list.find(c => c.id === invoice.value?.clientId) ?? null
)

const clientName = computed(() => {
  const c = client.value
  if (!c) return '—'
  return c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}`
})

const periodLabel = computed(() => {
  if (!invoice.value?.period) return ''
  const [y, m] = invoice.value.period.split('-')
  return `${UA_MONTHS[Number(m) - 1]} ${y}`
})

const icon = (component) => () => h(NIcon, null, { default: () => h(component) })

const menuOptions = computed(() => {
  const opts = [
    { label: 'Друкувати', key: 'print', icon: icon(PrintOutline) },
  ]
  if (invoice.value?.status === 'paid') {
    opts.push({ type: 'divider', key: 'd0' })
    opts.push({ label: 'Скасувати оплату', key: 'revert-paid', icon: icon(ArrowUndoOutline) })
  }
  if (invoice.value?.status !== 'cancelled') {
    opts.push({ type: 'divider', key: 'd1' })
    opts.push({ label: 'Скасувати рахунок', key: 'cancel', icon: icon(CloseCircleOutline) })
  }
  return opts
})

function onMenuSelect(key) {
  if (key === 'print') router.push({ name: 'billing-print', params: { id: props.id } })
  if (key === 'revert-paid') doRevertPaid()
  if (key === 'cancel') doCancel()
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}

function goBack() {
  if (route.query.from === 'client' && invoice.value?.clientId) {
    router.push({ name: 'client-detail', params: { id: invoice.value.clientId }, query: { tab: 'invoices' } })
  } else {
    router.back()
  }
}

async function load() {
  invoice.value = await BillingService.getById(props.id)
  const raw = await BillingService.getLinesByInvoiceId(props.id)
  lines.value = raw.map(l => ({ ...l, _key: newKey() }))
  linkedPayments.value = await PaymentService.getPaymentsByInvoiceId(Number(props.id))
}

async function onUpdateLine({ id, field, value }) {
  const line = lines.value.find(l => (l.id ?? l._key) === id)
  if (!line) return
  line[field] = value
  if (line.id) await BillingService.updateLine(line.id, { [field]: value })
}

async function addManualLine() {
  if (!invoice.value) return
  const sortOrder = lines.value.length
  const newId = await BillingService.addLine({
    invoiceId:  invoice.value.id,
    type:       'manual',
    ruleId:     null,
    instanceId: null,
    name:       '',
    qty:        1,
    unitPrice:  0,
    finalPrice: null,
    included:   true,
    notes:      '',
    sortOrder,
  })
  lines.value.push({ id: newId, _key: newKey(), type: 'manual', ruleId: null, instanceId: null, name: '', qty: 1, unitPrice: 0, finalPrice: null, included: true, notes: '', sortOrder })
}

async function addRateLine(rate) {
  if (!invoice.value) return
  const sortOrder = lines.value.length
  const newId = await BillingService.addLine({
    invoiceId:  invoice.value.id,
    type:       'manual',
    ruleId:     rate.ruleId ?? null,
    instanceId: null,
    name:       rate.name,
    qty:        1,
    unitPrice:  rate.price,
    finalPrice: null,
    included:   true,
    notes:      '',
    sortOrder,
  })
  lines.value.push({ id: newId, _key: newKey(), type: 'manual', ruleId: rate.ruleId ?? null, instanceId: null, name: rate.name, qty: 1, unitPrice: rate.price, finalPrice: null, included: true, notes: '', sortOrder })
}

async function removeLine({ id }) {
  const line = lines.value.find(l => (l.id ?? l._key) === id)
  if (!line) return
  if (line.id) await BillingService.deleteLine(line.id)
  lines.value = lines.value.filter(l => (l.id ?? l._key) !== id)
}

async function saveNotes(notes) {
  if (!invoice.value) return
  invoice.value.notes = notes
  await BillingService.updateNotes(invoice.value.id, notes)
}

async function onPaymentTypeChange(paymentType) {
  if (!invoice.value) return
  invoice.value.paymentType = paymentType
  await BillingService.updatePaymentType(invoice.value.id, paymentType)
}

async function doConfirm() {
  await BillingService.confirmInvoice(props.id)
  await load()
  message.success('Рахунок підтверджено')
}

async function doRevert() {
  dialog.warning({
    title: 'Повернути в чернетку?',
    content: 'Рахунок буде повернуто до статусу "Чернетка" для редагування.',
    positiveText: 'Так',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await BillingService.revertToDraft(props.id)
      await load()
    },
  })
}

function doPaid() {
  showPaymentModal.value = true
}

async function onPaymentRegistered() {
  await load()
  message.success('Рахунок оплачено')
}

async function doRevertPaid() {
  dialog.warning({
    title: 'Скасувати оплату?',
    content: 'Рахунок буде повернуто до статусу "Підтверджено".',
    positiveText: 'Так',
    negativeText: 'Назад',
    async onPositiveClick() {
      await BillingService.revertToConfirmed(props.id)
      await load()
      message.info('Ознаку оплати скасовано')
    },
  })
}

async function doCancel() {
  dialog.warning({
    title: 'Скасувати рахунок?',
    content: 'Рахунок буде позначено як скасований.',
    positiveText: 'Скасувати рахунок',
    negativeText: 'Назад',
    async onPositiveClick() {
      await BillingService.cancelInvoice(props.id)
      await load()
      message.info('Рахунок скасовано')
    },
  })
}

onMounted(async () => {
  loading.value = true
  if (clientsStore.list.length === 0) await clientsStore.fetchAll()
  await Promise.all([load(), BillingService.getActiveRates().then(r => { rates.value = r })])
  loading.value = false
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 860px;
}
</style>
