<template>
  <n-modal
    :show="show"
    preset="dialog"
    :show-icon="false"
    title="Реєстрація платежу"
    style="width: 560px;"
    @update:show="$emit('update:show', $event)"
  >
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" style="margin-top: 8px;">
      <n-form-item label="Клієнт" path="clientId">
        <n-select
          v-model:value="form.clientId"
          :options="clientOptions"
          :disabled="!!preInvoice"
          filterable
          placeholder="Оберіть клієнта"
          @update:value="onClientChange"
        />
      </n-form-item>

      <n-grid :cols="2" :x-gap="16">
        <n-form-item-gi label="Сума (грн)" path="amount">
          <n-input-number
            v-model:value="form.amount"
            :precision="2"
            :min="0.01"
            :step="100"
            style="width: 100%;"
            placeholder="0.00"
          />
        </n-form-item-gi>
        <n-form-item-gi label="Дата платежу" path="date">
          <n-date-picker
            v-model:value="form.date"
            type="date"
            style="width: 100%;"
          />
        </n-form-item-gi>
      </n-grid>

      <n-form-item label="Метод оплати" path="method">
        <n-radio-group v-model:value="form.method">
          <n-radio-button value="cash">Готівка</n-radio-button>
          <n-radio-button value="bank">Безготівка</n-radio-button>
          <n-radio-button value="writeoff">Списання</n-radio-button>
        </n-radio-group>
      </n-form-item>

      <n-form-item label="Прив'язати рахунки (необов'язково)">
        <div style="width: 100%;">
          <n-spin :show="loadingInvoices" size="small">
            <div v-if="clientInvoices.length === 0 && !loadingInvoices" style="opacity: 0.5; font-size: 13px;">
              {{ form.clientId ? 'Немає підтверджених рахунків' : 'Оберіть клієнта' }}
            </div>
            <n-scrollbar v-else style="max-height: 180px;">
              <div
                v-for="inv in clientInvoices"
                :key="inv.id"
                style="display: flex; align-items: center; gap: 8px; padding: 4px 0;"
              >
                <n-checkbox
                  :checked="form.selectedInvoiceIds.includes(inv.id)"
                  :disabled="lockedInvoiceIds.includes(inv.id)"
                  @update:checked="toggleInvoice(inv.id, $event)"
                />
                <span style="font-family: monospace; font-size: 13px; min-width: 110px;">{{ inv.number }}</span>
                <span style="font-size: 13px; opacity: 0.6; min-width: 90px;">{{ formatPeriod(inv.period) }}</span>
                <span style="font-size: 13px; font-weight: 500; margin-left: auto;">
                  {{ inv._total != null ? formatPrice(inv._total) : '—' }}
                </span>
              </div>
            </n-scrollbar>
          </n-spin>
        </div>
      </n-form-item>

      <n-form-item label="Примітка">
        <n-input
          v-model:value="form.notes"
          type="textarea"
          :rows="2"
          placeholder="Коментар до платежу..."
        />
      </n-form-item>
    </n-form>

    <template #action>
      <n-button @click="$emit('update:show', false)">Скасувати</n-button>
      <n-button type="primary" :loading="saving" @click="handleSubmit">Зареєструвати платіж</n-button>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import {
  NModal, NForm, NFormItem, NFormItemGi, NGrid, NSelect, NInputNumber,
  NDatePicker, NRadioGroup, NRadioButton, NInput, NButton, NCheckbox,
  NScrollbar, NSpin, useMessage,
} from 'naive-ui'
import { useClientsStore } from '@/stores/clients.js'
import { BillingService } from '@/modules/billing/services/BillingService.js'
import { PaymentService } from '../services/PaymentService.js'

const props = defineProps({
  show:        { type: Boolean, required: true },
  preInvoice:  { type: Object, default: null },
  preClientId: { type: Number, default: null },
})

const emit = defineEmits(['update:show', 'registered'])

const clientsStore = useClientsStore()
const message = useMessage()

const formRef        = ref(null)
const saving         = ref(false)
const loadingInvoices = ref(false)
const clientInvoices  = ref([])

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

const form = reactive({
  clientId:           null,
  amount:             null,
  date:               Date.now(),
  method:             'cash',
  notes:              '',
  selectedInvoiceIds: [],
})

const rules = {
  clientId: { required: true, message: 'Оберіть клієнта',     trigger: 'change', type: 'number' },
  amount:   { required: true, message: 'Введіть суму',         trigger: 'change', type: 'number', validator: (_, v) => v > 0 ? true : new Error('Сума має бути більше 0') },
  date:     { required: true, message: 'Вкажіть дату платежу', trigger: 'change', type: 'number' },
  method:   { required: true, message: 'Оберіть метод оплати', trigger: 'change' },
}

const lockedInvoiceIds = computed(() =>
  props.preInvoice ? [props.preInvoice.id] : []
)

const clientOptions = computed(() =>
  clientsStore.list.map(c => ({
    label: c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}`,
    value: c.id,
  }))
)

function formatPeriod(period) {
  const [y, m] = period.split('-')
  return `${UA_MONTHS[Number(m) - 1]} ${y}`
}

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}

function toggleInvoice(invoiceId, checked) {
  if (lockedInvoiceIds.value.includes(invoiceId)) return
  if (checked) {
    if (!form.selectedInvoiceIds.includes(invoiceId))
      form.selectedInvoiceIds.push(invoiceId)
  } else {
    form.selectedInvoiceIds = form.selectedInvoiceIds.filter(id => id !== invoiceId)
  }
}

async function loadClientInvoices(clientId) {
  if (!clientId) { clientInvoices.value = []; return }
  loadingInvoices.value = true
  try {
    const all = await BillingService.getByClientId(clientId)
    const confirmed = all.filter(inv => inv.status === 'confirmed')
    if (props.preInvoice && !confirmed.find(i => i.id === props.preInvoice.id)) {
      confirmed.unshift(props.preInvoice)
    }
    const withTotals = await Promise.all(
      confirmed.map(async inv => {
        const lines = await BillingService.getLinesByInvoiceId(inv.id)
        const total = lines.reduce((s, l) => {
          if (!l.included) return s
          return s + (l.finalPrice ?? l.qty * l.unitPrice)
        }, 0)
        return { ...inv, _total: total }
      })
    )
    clientInvoices.value = withTotals
  } finally {
    loadingInvoices.value = false
  }
}

async function prefillFromClient(clientId) {
  form.clientId = clientId
  await loadClientInvoices(clientId)
}

async function prefillFromInvoice(inv) {
  form.clientId = inv.clientId
  form.method   = inv.paymentType ?? 'cash'
  form.selectedInvoiceIds = [inv.id]
  await loadClientInvoices(inv.clientId)
  const matched = clientInvoices.value.find(i => i.id === inv.id)
  if (matched?._total != null) form.amount = matched._total
}

function onClientChange(clientId) {
  form.selectedInvoiceIds = form.selectedInvoiceIds.filter(id =>
    lockedInvoiceIds.value.includes(id)
  )
  loadClientInvoices(clientId)
}

function resetForm() {
  form.clientId           = null
  form.amount             = null
  form.date               = Date.now()
  form.method             = 'cash'
  form.notes              = ''
  form.selectedInvoiceIds = []
  clientInvoices.value    = []
}

async function handleSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const paymentId = await PaymentService.createPaymentWithInvoices(
      {
        clientId: form.clientId,
        amount:   form.amount,
        date:     form.date,
        method:   form.method,
        notes:    form.notes,
      },
      form.selectedInvoiceIds
    )
    emit('registered', paymentId)
    emit('update:show', false)
    resetForm()
  } catch (err) {
    message.error('Помилка при збереженні платежу')
    console.error(err)
  } finally {
    saving.value = false
  }
}

watch(() => props.show, async (visible) => {
  if (visible) {
    resetForm()
    if (clientsStore.list.length === 0) await clientsStore.fetchAll()
    if (props.preInvoice) await prefillFromInvoice(props.preInvoice)
    else if (props.preClientId) await prefillFromClient(props.preClientId)
  }
})
</script>
