<template>
  <div class="view-container">
    <n-spin :show="loading">
      <template v-if="client">
        <n-page-header :title="pageTitle" @back="$router.push({ name: 'clients' })">
          <template #extra>
            <n-space>
              <n-button @click="$router.push({ name: 'client-edit', params: { id: client.id } })">Редагувати</n-button>
              <n-button type="error" ghost @click="confirmDelete">Видалити</n-button>
            </n-space>
          </template>
          <template #header>
            <n-space size="small">
              <n-tag type="info" size="small">{{ clientTypeLabel }}</n-tag>
              <n-tag :type="statusType(client.status)" size="small">{{ statusLabel(client.status) }}</n-tag>
            </n-space>
          </template>
        </n-page-header>

        <n-tabs
          v-model:value="activeTab"
          type="line"
          placement="right"
          style="margin-top: 20px;"
        >
          <n-tab-pane name="info" tab="Інфо & Теги">
            <n-descriptions bordered :column="2">
              <template v-if="client.clientType === 'legal'">
                <n-descriptions-item label="Організація" :span="2">{{ client.company }}</n-descriptions-item>
                <n-descriptions-item v-if="client.lastName || client.firstName" label="Контактна особа">
                  {{ client.lastName }} {{ client.firstName }}
                </n-descriptions-item>
              </template>
              <template v-else>
                <n-descriptions-item label="Прізвище">{{ client.lastName }}</n-descriptions-item>
                <n-descriptions-item label="Ім'я">{{ client.firstName }}</n-descriptions-item>
                <n-descriptions-item v-if="client.company" label="Компанія">{{ client.company }}</n-descriptions-item>
                <n-descriptions-item v-if="client.position" label="Посада">{{ client.position }}</n-descriptions-item>
              </template>
              <n-descriptions-item label="Телефон">{{ client.phone || '—' }}</n-descriptions-item>
              <n-descriptions-item label="Email">{{ client.email || '—' }}</n-descriptions-item>
              <n-descriptions-item label="Адреса" :span="2">{{ client.address || '—' }}</n-descriptions-item>
              <n-descriptions-item v-if="clientGroup" label="Група" :span="2">
                {{ clientGroup.name }}
                <n-text v-if="clientGroup.contactPerson" depth="3" style="margin-left: 8px;">
                  {{ clientGroup.contactPerson }}
                  <template v-if="clientGroup.contactPhone"> · {{ clientGroup.contactPhone }}</template>
                </n-text>
              </n-descriptions-item>
              <n-descriptions-item v-if="client.notes" label="Нотатки" :span="2">{{ client.notes }}</n-descriptions-item>
            </n-descriptions>

            <div class="section-label">Теги</div>
            <ClientTagsSelect :client-id="client.id" @change="store.fetchAll()" />
          </n-tab-pane>

          <n-tab-pane name="tax" tab="Податковий профіль">
            <ClientTaxView :client-id="client.id" :created-at="client.createdAt" />
          </n-tab-pane>

          <n-tab-pane name="invoices" tab="Рахунки">
            <ClientInvoicesTab :client-id="client.id" />
          </n-tab-pane>

          <n-tab-pane name="interactions" tab="Взаємодії">
            <InteractionList :client-id="client.id" />
          </n-tab-pane>
        </n-tabs>
      </template>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NPageHeader, NButton, NSpace, NTag, NText, NDescriptions, NDescriptionsItem,
  NSpin, NTabs, NTabPane,
} from 'naive-ui'
import { useDialog, useMessage } from 'naive-ui'
import { useClientsStore } from '@/stores/clients.js'
import { useGroupsStore } from '@/stores/groups.js'
import InteractionList from '@/components/InteractionList.vue'
import ClientTagsSelect from '@/components/ClientTagsSelect.vue'
import ClientTaxView from '@/modules/tax/views/ClientTaxView.vue'
import ClientInvoicesTab from '@/modules/billing/components/ClientInvoicesTab.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts.js'
import { statusLabel, statusType, CLIENT_TYPE_MAP } from '@/constants/clients.js'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const route  = useRoute()
const store = useClientsStore()
const groupsStore = useGroupsStore()
const dialog = useDialog()
const message = useMessage()

const client    = ref(null)
const loading   = ref(false)
const activeTab = ref(route.query.tab ?? 'info')

const clientTypeLabel = computed(() => CLIENT_TYPE_MAP[client.value?.clientType] ?? 'Фізична особа')

const pageTitle = computed(() => {
  if (!client.value) return ''
  return client.value.clientType === 'legal'
    ? client.value.company
    : `${client.value.lastName} ${client.value.firstName}`
})

const clientGroup = computed(() =>
  client.value?.groupId ? groupsStore.list.find(g => g.id === client.value.groupId) : null
)

async function load() {
  loading.value = true
  await groupsStore.fetchAll()
  client.value = await store.getById(props.id)
  loading.value = false
}

function confirmDelete() {
  dialog.warning({
    title: 'Видалити клієнта?',
    content: `${client.value.lastName} ${client.value.firstName} буде видалений разом з усією історією взаємодій.`,
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await store.remove(props.id)
      message.success('Клієнта видалено')
      router.push({ name: 'clients' })
    },
  })
}

useKeyboardShortcuts({
  'escape': () => router.push({ name: 'clients' }),
})

onMounted(load)
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 960px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 20px;
  margin-bottom: 8px;
}
</style>
