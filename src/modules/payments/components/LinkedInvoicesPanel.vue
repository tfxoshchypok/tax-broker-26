<template>
  <div>
    <n-spin :show="loading" size="small">
      <div v-if="!loading && invoices.length === 0" style="opacity: 0.5; font-size: 13px;">
        Standalone платіж (аванс) — рахунки не прив'язані
      </div>
      <div v-else class="linked-list">
        <div
          v-for="inv in invoices"
          :key="inv.id"
          class="linked-row"
          @click="router.push({ name: 'billing-invoice', params: { id: inv.id } })"
        >
          <InvoiceStatusBadge :status="inv.status" />
          <span style="font-family: monospace; font-size: 13px;">{{ inv.number }}</span>
          <span style="font-size: 13px; opacity: 0.6;">{{ formatPeriod(inv.period) }}</span>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NSpin } from 'naive-ui'
import { PaymentService } from '../services/PaymentService.js'
import InvoiceStatusBadge from '@/modules/billing/components/InvoiceStatusBadge.vue'

const props = defineProps({
  paymentId: { type: Number, required: true },
})

const router = useRouter()
const loading  = ref(true)
const invoices = ref([])

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

function formatPeriod(period) {
  const [y, m] = period.split('-')
  return `${UA_MONTHS[Number(m) - 1]} ${y}`
}

onMounted(async () => {
  invoices.value = await PaymentService.getLinkedInvoices(props.paymentId)
  loading.value = false
})
</script>

<style scoped>
.linked-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.linked-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.linked-row:hover {
  background: rgba(128, 128, 128, 0.08);
}
</style>
