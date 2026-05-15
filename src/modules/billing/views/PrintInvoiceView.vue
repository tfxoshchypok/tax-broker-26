<template>
  <div class="print-page">
    <div v-if="loading" class="loading-placeholder">Завантаження...</div>

    <template v-else-if="invoice">
      <h1 class="invoice-title">Рахунок {{ invoice.number }}</h1>
      <p class="invoice-period">{{ periodLabel }} · {{ invoiceDateLabel }}</p>

      <div class="parties">
        <div v-if="showOwner" class="party">
          <div class="party-label">Виконавець</div>
          <div v-if="owner">
            <div v-if="owner.fullName" class="party-name">{{ owner.fullName }}</div>
            <div v-if="owner.ipn">ІПН: {{ owner.ipn }}</div>
            <div v-if="owner.iban">IBAN: {{ owner.iban }}</div>
            <div v-if="owner.bankName">{{ owner.bankName }}</div>
            <div v-if="owner.address">{{ owner.address }}</div>
            <div v-if="owner.phone">{{ owner.phone }}</div>
            <div v-if="owner.email">{{ owner.email }}</div>
          </div>
          <div v-else class="party-empty">Реквізити не вказано</div>
        </div>

        <div class="party">
          <div class="party-label">Замовник</div>
          <div v-if="client">
            <div class="party-name">{{ clientName }}</div>
            <div v-if="client.clientType === 'fop' || client.clientType === 'individual'">
              ІПН: {{ client.ipn || '—' }}
            </div>
            <div v-if="client.clientType === 'legal'">
              ЄДРПОУ: {{ client.edrpou || '—' }}
            </div>
            <div v-if="client.phone">{{ client.phone }}</div>
            <div v-if="client.email">{{ client.email }}</div>
          </div>
        </div>
      </div>

      <table class="lines-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-name">Послуга</th>
            <th class="col-qty">Кіл.</th>
            <th class="col-price">Ціна</th>
            <th class="col-total">Сума</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, i) in includedLines" :key="line.id">
            <td class="col-num">{{ i + 1 }}</td>
            <td class="col-name">{{ line.name || '—' }}</td>
            <td class="col-qty">{{ line.qty }}</td>
            <td class="col-price">{{ formatMoney(line.unitPrice) }}</td>
            <td class="col-total">{{ formatMoney(effectiveTotal(line)) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="total-label">Разом:</td>
            <td class="col-total total-value">{{ formatMoney(grandTotal) }}</td>
          </tr>
        </tfoot>
      </table>

      <div v-if="invoice.notes" class="notes">{{ invoice.notes }}</div>

      <div class="signatures">
        <div v-if="showOwner" class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-caption">Виконавець</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-caption">Замовник</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useClientsStore } from '@/stores/clients.js'
import { useOwnerProfileStore } from '@/stores/ownerProfile.js'
import { useUiStore } from '@/stores/ui.js'
import { BillingService } from '../services/BillingService.js'

const props = defineProps({ id: { type: String, required: true } })

const router       = useRouter()
const clientsStore = useClientsStore()
const ownerStore   = useOwnerProfileStore()
const ui           = useUiStore()

const loading = ref(true)
const invoice = ref(null)
const lines   = ref([])

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

const owner = computed(() => ownerStore.profile)

const showOwner = computed(() =>
  invoice.value?.paymentType !== 'cash' || ui.showOwnerOnCash
)

const client = computed(() =>
  clientsStore.list.find(c => c.id === invoice.value?.clientId) ?? null
)

const clientName = computed(() => {
  const c = client.value
  if (!c) return '—'
  return c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}${c.middleName ? ' ' + c.middleName : ''}`
})

const periodLabel = computed(() => {
  if (!invoice.value?.period) return ''
  const [y, m] = invoice.value.period.split('-')
  return `${UA_MONTHS[Number(m) - 1]} ${y}`
})

const invoiceDateLabel = computed(() => {
  if (!invoice.value?.createdAt) return ''
  return new Date(invoice.value.createdAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
})

const includedLines = computed(() => lines.value.filter(l => l.included))

function effectiveTotal(line) {
  return line.finalPrice != null ? line.finalPrice : line.qty * line.unitPrice
}

const grandTotal = computed(() =>
  includedLines.value.reduce((sum, l) => sum + effectiveTotal(l), 0)
)

function formatMoney(val) {
  return Number(val ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' грн'
}

onMounted(async () => {
  loading.value = true
  await Promise.all([
    clientsStore.list.length === 0 ? clientsStore.fetchAll() : Promise.resolve(),
    ownerStore.load(),
  ])
  invoice.value = await BillingService.getById(props.id)
  lines.value   = await BillingService.getLinesByInvoiceId(props.id)
  loading.value = false
  await nextTick()
  window.addEventListener('afterprint', () => {
    router.replace({ name: 'billing-invoice', params: { id: props.id } })
  }, { once: true })
  window.print()
})
</script>

<style>
@media print {
  .n-layout-sider { display: none !important; }
  body * { visibility: hidden; }
  .print-page,
  .print-page * { visibility: visible; }
  .print-page {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }
}
</style>

<style scoped>
.print-page {
  padding: 32px 48px;
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Times New Roman', serif;
  font-size: 13px;
  color: #000;
}

.loading-placeholder {
  text-align: center;
  padding: 60px;
  opacity: 0.5;
}

.invoice-title {
  font-size: 22px;
  font-weight: bold;
  margin: 0 0 4px;
}

.invoice-period {
  margin: 0 0 24px;
  opacity: 0.6;
  font-size: 12px;
}

.parties {
  display: flex;
  gap: 40px;
  margin-bottom: 24px;
}

.party {
  flex: 1;
  font-size: 12px;
  line-height: 1.6;
}

.party-label {
  font-weight: bold;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
  opacity: 0.5;
}

.party-name {
  font-weight: bold;
  font-size: 13px;
}

.party-empty {
  opacity: 0.4;
  font-style: italic;
}

.lines-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  font-size: 12px;
}

.lines-table th,
.lines-table td {
  border: 1px solid #ccc;
  padding: 5px 8px;
  text-align: left;
}

.lines-table thead th {
  background: #f5f5f5;
  font-weight: bold;
}

.col-num   { width: 32px; text-align: center; }
.col-qty   { width: 48px; text-align: center; }
.col-price { width: 100px; text-align: right; }
.col-total { width: 110px; text-align: right; }

.total-label {
  text-align: right;
  font-weight: bold;
  border-right: none;
}

.total-value {
  font-weight: bold;
}

.notes {
  margin-bottom: 32px;
  font-size: 12px;
  opacity: 0.7;
  font-style: italic;
}

.signatures {
  display: flex;
  justify-content: space-between;
  margin-top: 48px;
  gap: 60px;
}

.signature-block {
  flex: 1;
  text-align: center;
}

.signature-line {
  border-bottom: 1px solid #000;
  margin-bottom: 6px;
  height: 36px;
}

.signature-caption {
  font-size: 11px;
  opacity: 0.6;
}

@media print {
  .print-page {
    padding: 16px 24px;
  }
}
</style>
