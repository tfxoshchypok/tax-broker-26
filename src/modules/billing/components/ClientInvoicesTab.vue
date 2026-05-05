<template>
  <div>
    <div class="tab-header">
      <n-button v-if="activeTab === 'invoices'" size="small" type="primary" @click="goToNew">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        Новий рахунок
      </n-button>
      <n-button v-else size="small" type="primary" @click="showPaymentModal = true">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        Новий платіж
      </n-button>
    </div>

    <n-spin :show="loading" style="margin-top: 16px;">
      <template v-if="!loading">
        <!-- Stats -->
        <div v-if="hasAnyData" class="stats-row">
          <div class="stat-card">
            <div class="stat-value">{{ formatPrice(stats.invoicesTotal) }}</div>
            <div class="stat-label">Виставлено рахунків</div>
            <div class="stat-amount">{{ stats.invoicesCount }} рах.</div>
          </div>
          <div class="stat-divider" />
          <div class="stat-card stat-card--paid">
            <div class="stat-value">{{ formatPrice(stats.paymentsTotal) }}</div>
            <div class="stat-label">Зареєстровано платежів</div>
            <div class="stat-amount">{{ stats.paymentsCount }} плат.</div>
          </div>
          <div class="stat-divider" />
          <div class="stat-card" :class="balanceClass">
            <div class="stat-value">{{ formatPrice(Math.abs(stats.balance)) }}</div>
            <div class="stat-label">Сальдо</div>
            <div class="stat-amount">{{ balanceLabel }}</div>
          </div>
        </div>

        <!-- Sub-tabs -->
        <n-tabs v-model:value="activeTab" type="line">
          <n-tab-pane name="invoices" tab="Рахунки">
            <n-empty v-if="!invoices.length" description="Рахунків немає" style="margin-top: 32px;" />
            <div v-else class="invoice-list">
              <div
                v-for="inv in invoices"
                :key="inv.id"
                class="invoice-row"
                @click="$router.push({ name: 'billing-invoice', params: { id: inv.id }, query: { from: 'client' } })"
              >
                <InvoiceStatusBadge :status="inv.status" />
                <span class="inv-number">{{ inv.number }}</span>
                <span class="inv-period">{{ formatPeriod(inv.period) }}</span>
                <span class="inv-amount">
                  <template v-if="inv.status !== 'draft'">
                    {{ totals[inv.id] !== undefined ? formatPrice(totals[inv.id]) : '…' }}
                  </template>
                  <template v-else>чернетка</template>
                </span>
              </div>
            </div>
          </n-tab-pane>

          <n-tab-pane name="payments" tab="Платежі">
            <n-empty v-if="!payments.length" description="Платежів немає" style="margin-top: 32px;">
              <template #extra>
                <n-button size="small" @click="showPaymentModal = true">Зареєструвати платіж</n-button>
              </template>
            </n-empty>
            <div v-else class="payment-list">
              <div v-for="p in payments" :key="p.id" class="payment-row">
                <span class="pay-date">{{ formatDate(p.date) }}</span>
                <PaymentMethodBadge :method="p.method" />
                <div class="pay-center">
                  <div v-if="paymentInvoices[p.id]?.length" class="pay-inv-tags">
                    <n-tag
                      v-for="inv in paymentInvoices[p.id]"
                      :key="inv.id"
                      size="tiny"
                      style="cursor: pointer; font-family: monospace;"
                      @click.stop="$router.push({ name: 'billing-invoice', params: { id: inv.id }, query: { from: 'client' } })"
                    >
                      {{ inv.number }}
                    </n-tag>
                  </div>
                  <span v-if="p.notes" class="pay-notes">{{ p.notes }}</span>
                </div>
                <span class="pay-amount">{{ formatPrice(p.amount) }}</span>
              </div>
            </div>
          </n-tab-pane>
        </n-tabs>
      </template>
    </n-spin>

    <RegisterPaymentModal
      v-model:show="showPaymentModal"
      :pre-invoice="null"
      :pre-client-id="props.clientId"
      @registered="onPaymentRegistered"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NIcon, NSpin, NEmpty, NTabs, NTabPane, NTag } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { BillingService } from '../services/BillingService.js'
import { PaymentService } from '@/modules/payments/services/PaymentService.js'
import InvoiceStatusBadge from './InvoiceStatusBadge.vue'
import PaymentMethodBadge from '@/modules/payments/components/PaymentMethodBadge.vue'
import RegisterPaymentModal from '@/modules/payments/components/RegisterPaymentModal.vue'

const props = defineProps({
  clientId: { type: Number, required: true },
})

const router          = useRouter()
const loading         = ref(true)
const activeTab       = ref('invoices')
const invoices        = ref([])
const totals          = ref({})
const payments        = ref([])
const paymentInvoices = ref({})
const showPaymentModal = ref(false)

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

function formatPeriod(period) {
  const [y, m] = period.split('-')
  return `${UA_MONTHS[Number(m) - 1]} ${y}`
}

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function lineTotal(line) {
  if (!line.included) return 0
  return line.finalPrice ?? (line.qty * line.unitPrice)
}

const hasAnyData = computed(() => invoices.value.length > 0 || payments.value.length > 0)

const stats = computed(() => {
  const issued = invoices.value.filter(i => i.status === 'confirmed' || i.status === 'paid')
  const invoicesTotal = issued.reduce((s, i) => s + (totals.value[i.id] ?? 0), 0)
  const paymentsTotal = payments.value.reduce((s, p) => s + p.amount, 0)
  return {
    invoicesCount: issued.length,
    invoicesTotal,
    paymentsCount: payments.value.length,
    paymentsTotal,
    balance: invoicesTotal - paymentsTotal,
  }
})

const balanceClass = computed(() => {
  if (stats.value.balance > 0.005) return 'stat-card--pending'
  return 'stat-card--paid'
})

const balanceLabel = computed(() => {
  if (stats.value.balance > 0.005) return 'борг клієнта'
  if (stats.value.balance < -0.005) return 'переплата'
  return 'розрахунки закриті'
})

function goToNew() {
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  router.push({ name: 'billing-new', query: { clientId: props.clientId, period } })
}

async function loadInvoiceTotals(list) {
  await Promise.all(
    list
      .filter(inv => inv.status !== 'draft')
      .map(async inv => {
        const lines = await BillingService.getLinesByInvoiceId(inv.id)
        totals.value[inv.id] = lines.reduce((s, l) => s + lineTotal(l), 0)
      })
  )
}

async function loadPaymentLinks(list) {
  await Promise.all(
    list.map(async p => {
      const invs = await PaymentService.getLinkedInvoices(p.id)
      paymentInvoices.value[p.id] = invs
    })
  )
}

async function onPaymentRegistered() {
  const [invoiceList, paymentList] = await Promise.all([
    BillingService.getByClientId(props.clientId),
    PaymentService.getByClientId(props.clientId),
  ])
  invoices.value = invoiceList.sort((a, b) => b.period.localeCompare(a.period))
  payments.value = paymentList
  await Promise.all([
    loadInvoiceTotals(invoiceList),
    loadPaymentLinks(paymentList),
  ])
}

onMounted(async () => {
  loading.value = true
  const [invoiceList, paymentList] = await Promise.all([
    BillingService.getByClientId(props.clientId),
    PaymentService.getByClientId(props.clientId),
  ])
  invoices.value = invoiceList.sort((a, b) => b.period.localeCompare(a.period))
  payments.value = paymentList
  await Promise.all([
    loadInvoiceTotals(invoiceList),
    loadPaymentLinks(paymentList),
  ])
  loading.value = false
})
</script>

<style scoped>
.tab-header {
  display: flex;
  justify-content: flex-end;
}

.stats-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: rgba(128, 128, 128, 0.05);
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.stat-card {
  flex: 1;
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-divider {
  width: 1px;
  background: rgba(128, 128, 128, 0.15);
  flex-shrink: 0;
}

.stat-value {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-amount {
  font-size: 13px;
  font-weight: 500;
  margin-top: 4px;
  opacity: 0.8;
}

.stat-card--pending .stat-value,
.stat-card--pending .stat-amount {
  color: #d18b00;
}

.stat-card--paid .stat-value,
.stat-card--paid .stat-amount {
  color: #18a058;
}

.invoice-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.invoice-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.invoice-row:hover {
  background: rgba(128, 128, 128, 0.07);
}

.inv-number {
  font-family: monospace;
  font-size: 13px;
  min-width: 110px;
}

.inv-period {
  font-size: 13px;
  opacity: 0.6;
  min-width: 110px;
}

.inv-amount {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  text-align: right;
}

.payment-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.payment-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 6px;
}

.pay-date {
  font-size: 13px;
  opacity: 0.65;
  min-width: 90px;
  white-space: nowrap;
}

.pay-center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.pay-inv-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.pay-notes {
  font-size: 13px;
  opacity: 0.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pay-amount {
  font-size: 14px;
  font-weight: 600;
  color: #18a058;
  white-space: nowrap;
}
</style>
