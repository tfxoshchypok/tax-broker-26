<template>
  <div class="view-container">
    <n-page-header title="Новий рахунок" @back="$router.back()">
      <template #subtitle>
        <span v-if="client">{{ clientName }} · {{ periodLabel }}</span>
      </template>
    </n-page-header>

    <n-spin :show="loading" style="margin-top: 20px;">
      <!-- Existing invoice info -->
      <n-alert
        v-if="existingInvoice"
        type="info"
        style="margin-bottom: 16px;"
      >
        За цей місяць вже є рахунок
        <n-button
          text
          type="info"
          size="small"
          @click="$router.push({ name: 'billing-invoice', params: { id: existingInvoice.id } })"
        >{{ existingInvoice.number }}</n-button>
        ({{ existingInvoiceStatusLabel }}).
        <template v-if="coveredCount > 0">
          {{ coveredCount }} {{ coveredCountWord }} вже включено — показано лише непокриті.
        </template>
        <template v-else>
          Усі послуги вже включено — рахунок буде порожнім.
        </template>
      </n-alert>

      <template v-if="!loading && client">
        <n-alert v-if="!taxProfile" type="info" style="margin-bottom: 16px;">
          Податковий профіль клієнта не налаштовано. Рядки не будуть сформовані автоматично.
        </n-alert>

        <InvoiceLineEditor
          :lines="lines"
          :readonly="false"
          :rates="rates"
          @update:line="onUpdateLine"
          @add-line="addManualLine"
          @remove-line="removeLocalLine"
          @add-from-rate="addRateLine"
        />

        <n-form style="margin-top: 16px;" :model="form">
          <n-form-item label="Тип оплати">
            <n-radio-group v-model:value="form.paymentType">
              <n-radio-button value="cash">Готівка</n-radio-button>
              <n-radio-button value="bank">Безготівка</n-radio-button>
              <n-radio-button value="writeoff">Списання</n-radio-button>
            </n-radio-group>
          </n-form-item>
          <n-form-item label="Примітка">
            <n-input v-model:value="form.notes" type="textarea" :rows="2" placeholder="Коментар до рахунку..." />
          </n-form-item>
        </n-form>

        <div class="form-actions">
          <n-button @click="$router.back()">Скасувати</n-button>
          <n-button :loading="saving" @click="saveDraft">Зберегти чернетку</n-button>
          <n-button type="primary" :loading="saving" @click="confirm">Підтвердити рахунок</n-button>
        </div>
      </template>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NPageHeader, NButton, NSpin, NAlert, NForm, NFormItem, NInput, NRadioGroup, NRadioButton, useMessage,
} from 'naive-ui'
import { useClientsStore } from '@/stores/clients.js'
import { useTaxProfilesStore } from '@/modules/tax/stores/taxProfiles.js'
import { getExpectedReports } from '@/modules/tax/services/TaxReportEngine.js'
import { TaxReportService } from '@/modules/tax/services/TaxReportService.js'
import { BillingService } from '../services/BillingService.js'
import { InvoiceGenerator } from '../services/InvoiceGenerator.js'
import InvoiceLineEditor from '../components/InvoiceLineEditor.vue'

const router = useRouter()
const route  = useRoute()
const clientsStore = useClientsStore()
const profilesStore = useTaxProfilesStore()
const message = useMessage()

const clientId = computed(() => Number(route.query.clientId))
const period   = computed(() => route.query.period ?? '')

const periodYear  = computed(() => Number(period.value.split('-')[0]))
const periodMonth = computed(() => Number(period.value.split('-')[1]))

const loading = ref(true)
const saving  = ref(false)

const client          = ref(null)
const taxProfile      = ref(null)
const existingInvoice = ref(null)
const coveredRuleIds  = ref(new Set())
const lines           = ref([])
const rates           = ref([])
const form            = ref({ notes: '', paymentType: 'cash' })

const INVOICE_STATUS_LABELS = {
  draft: 'Чернетка', confirmed: 'Підтверджено', paid: 'Оплачено', cancelled: 'Скасовано',
}
const existingInvoiceStatusLabel = computed(() =>
  INVOICE_STATUS_LABELS[existingInvoice.value?.status] ?? ''
)

const coveredCount = computed(() => coveredRuleIds.value.size)

function pluralizeSvc(n) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'послуг'
  if (mod10 === 1) return 'послугу'
  if (mod10 >= 2 && mod10 <= 4) return 'послуги'
  return 'послуг'
}
const coveredCountWord = computed(() => pluralizeSvc(coveredCount.value))

let _lineKey = 0
function newKey() { return `new_${++_lineKey}` }

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

const clientName = computed(() => {
  if (!client.value) return ''
  return client.value.clientType === 'legal'
    ? client.value.company
    : `${client.value.lastName} ${client.value.firstName}`
})

const periodLabel = computed(() => {
  if (!period.value) return ''
  const [y, m] = period.value.split('-')
  return `${UA_MONTHS[Number(m) - 1]} ${y}`
})

function onUpdateLine({ id, field, value }) {
  const line = lines.value.find(l => (l.id ?? l._key) === id)
  if (line) line[field] = value
}

function addManualLine() {
  lines.value.push({
    _key: newKey(),
    id: null,
    type: 'manual',
    ruleId: null,
    instanceId: null,
    name: '',
    qty: 1,
    unitPrice: 0,
    finalPrice: null,
    included: true,
    notes: '',
    sortOrder: lines.value.length,
  })
}

function addRateLine(rate) {
  lines.value.push({
    _key: newKey(),
    id: null,
    type: 'manual',
    ruleId: rate.ruleId ?? null,
    instanceId: null,
    name: rate.name,
    qty: 1,
    unitPrice: rate.price,
    finalPrice: null,
    included: true,
    notes: '',
    sortOrder: lines.value.length,
  })
}

function removeLocalLine({ id }) {
  lines.value = lines.value.filter(l => (l.id ?? l._key) !== id)
}

async function saveInvoice(status) {
  saving.value = true
  try {
    const invoiceId = await BillingService.createInvoice({
      clientId: clientId.value,
      period: period.value,
      status,
      paymentType: form.value.paymentType,
      notes: form.value.notes,
    })
    const linesToSave = lines.value.map((l, i) => ({
      invoiceId,
      type:        l.type,
      ruleId:      l.ruleId ?? null,
      instanceId:  l.instanceId ?? null,
      name:        l.name,
      qty:         l.qty,
      unitPrice:   l.unitPrice,
      finalPrice:  l.finalPrice ?? null,
      included:    l.included,
      notes:       l.notes ?? '',
      sortOrder:   i,
    }))
    await BillingService.bulkCreateLines(linesToSave)
    if (status === 'confirmed') await BillingService.confirmInvoice(invoiceId)
    message.success(status === 'confirmed' ? 'Рахунок підтверджено' : 'Чернетку збережено')
    router.replace({ name: 'billing-invoice', params: { id: invoiceId } })
  } finally {
    saving.value = false
  }
}

async function saveDraft()  { await saveInvoice('draft') }
async function confirm()    { await saveInvoice('confirmed') }

onMounted(async () => {
  loading.value = true
  if (clientsStore.list.length === 0) await clientsStore.fetchAll()
  client.value = clientsStore.list.find(c => c.id === clientId.value) ?? null

  // Check for duplicate
  const existing = await BillingService.getByClientId(clientId.value)
  existingInvoice.value = existing.find(inv => inv.period === period.value) ?? null

  // Load tax profile
  await profilesStore.load(clientId.value)
  taxProfile.value = profilesStore.getProfile(clientId.value)

  if (existingInvoice.value) {
    const existingLines = await BillingService.getLinesByInvoiceId(existingInvoice.value.id)
    coveredRuleIds.value = new Set(existingLines.map(l => l.ruleId).filter(Boolean))
  }

  rates.value = await BillingService.getActiveRates()

  if (taxProfile.value) {
    const allExpectedReports = getExpectedReports(taxProfile.value, periodYear.value, periodMonth.value)
    const uncoveredReports = existingInvoice.value
      ? allExpectedReports.filter(r => !coveredRuleIds.value.has(r.rule.id))
      : allExpectedReports
    const instances = await TaxReportService.getByClientId(clientId.value)
    lines.value = InvoiceGenerator.generateDraftLines(uncoveredReports, rates.value, instances)
      .map(l => ({ ...l, _key: newKey() }))
  }

  loading.value = false
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 860px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
