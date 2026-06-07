<template>
  <div class="print-page">
    <div v-if="loading" class="loading-placeholder">Завантаження...</div>
    <div v-else-if="!template" class="loading-placeholder">Шаблон не знайдено</div>
    <DocumentRenderer v-else :template="template" :context="context" />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useClientsStore } from '@/stores/clients.js'
import { useOwnerProfileStore } from '@/stores/ownerProfile.js'
import { BillingService } from '../services/BillingService.js'
import { DocumentTemplateService } from '@/modules/documents/services/DocumentTemplateService.js'
import { buildContext } from '@/modules/documents/config/dataSchema.js'
import DocumentRenderer from '@/modules/documents/components/DocumentRenderer.vue'

const props = defineProps({ id: { type: String, required: true } })

const router = useRouter()
const route = useRoute()
const clientsStore = useClientsStore()
const ownerStore = useOwnerProfileStore()

const loading = ref(true)
const template = ref(null)
const context = ref({})

onMounted(async () => {
  loading.value = true
  await Promise.all([
    clientsStore.list.length === 0 ? clientsStore.fetchAll() : Promise.resolve(),
    ownerStore.load(),
  ])

  const invoice = await BillingService.getById(props.id)
  const lines = await BillingService.getLinesByInvoiceId(props.id)
  const client = clientsStore.list.find(c => c.id === invoice?.clientId) ?? null

  const tplId = route.query.templateId
  template.value = tplId ? await DocumentTemplateService.getById(tplId) : null
  if (!template.value) template.value = await DocumentTemplateService.getDefault('invoices')

  context.value = buildContext('invoices', {
    invoices: { ...invoice, lines },
    clients: client,
    ownerProfile: ownerStore.profile,
  })

  loading.value = false
  if (!template.value) return

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
}

.loading-placeholder {
  text-align: center;
  padding: 60px;
  opacity: 0.5;
}

@media print {
  .print-page {
    padding: 16px 24px;
  }
}
</style>
