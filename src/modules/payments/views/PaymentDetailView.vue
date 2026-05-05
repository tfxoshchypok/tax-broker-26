<template>
  <div class="view-container">
    <n-spin :show="loading">
      <template v-if="payment">
        <n-page-header :title="formatDate(payment.date)" @back="$router.push({ name: 'payments-dashboard' })">
          <template #subtitle>
            <n-button
              text
              @click="$router.push({ name: 'client-detail', params: { id: payment.clientId } })"
            >
              {{ clientName }}
            </n-button>
          </template>
          <template #extra>
            <n-button type="error" ghost @click="doDelete">Видалити</n-button>
          </template>
        </n-page-header>

        <div class="detail-grid" style="margin-top: 24px;">
          <div class="detail-row">
            <span class="detail-label">Сума</span>
            <span class="detail-value amount">{{ formatPrice(payment.amount) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Метод</span>
            <PaymentMethodBadge :method="payment.method" />
          </div>
          <div class="detail-row">
            <span class="detail-label">Дата</span>
            <span class="detail-value">{{ formatDate(payment.date) }}</span>
          </div>
          <div v-if="payment.notes" class="detail-row">
            <span class="detail-label">Примітка</span>
            <span class="detail-value" style="opacity: 0.75;">{{ payment.notes }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Зареєстровано</span>
            <span class="detail-value" style="opacity: 0.5; font-size: 13px;">{{ formatDate(payment.createdAt) }}</span>
          </div>
        </div>

        <n-divider style="margin: 24px 0 16px;" />
        <div style="font-size: 13px; font-weight: 600; opacity: 0.6; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
          Прив'язані рахунки
        </div>
        <LinkedInvoicesPanel :payment-id="payment.id" />
      </template>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NPageHeader, NButton, NSpin, NDivider, useDialog, useMessage } from 'naive-ui'
import { useClientsStore } from '@/stores/clients.js'
import { PaymentService } from '../services/PaymentService.js'
import PaymentMethodBadge from '../components/PaymentMethodBadge.vue'
import LinkedInvoicesPanel from '../components/LinkedInvoicesPanel.vue'

const props = defineProps({ id: { type: String, required: true } })

const router       = useRouter()
const clientsStore = useClientsStore()
const dialog       = useDialog()
const message      = useMessage()

const loading = ref(true)
const payment = ref(null)

const clientName = computed(() => {
  const c = clientsStore.list.find(c => c.id === payment.value?.clientId)
  if (!c) return '—'
  return c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}`
})

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}

async function load() {
  payment.value = await PaymentService.getById(props.id)
}

async function doDelete() {
  dialog.warning({
    title: 'Видалити платіж?',
    content: 'Запис платежу буде видалено. Статус пов\'язаних рахунків не зміниться.',
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await PaymentService.deletePayment(props.id)
      message.info('Платіж видалено')
      router.push({ name: 'payments-dashboard' })
    },
  })
}

onMounted(async () => {
  loading.value = true
  if (clientsStore.list.length === 0) await clientsStore.fetchAll()
  await load()
  loading.value = false
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 700px;
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.detail-label {
  font-size: 13px;
  opacity: 0.55;
  min-width: 110px;
}

.detail-value {
  font-size: 15px;
}

.detail-value.amount {
  font-weight: 700;
  font-size: 20px;
  color: #18a058;
}
</style>
