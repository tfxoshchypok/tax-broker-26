<template>
  <div class="view-container">
    <n-page-header :title="title" @back="goBack">
      <template #extra>
        <n-space>
          <n-button @click="goBack">Скасувати</n-button>
          <n-button type="primary" :loading="saving" @click="save">Зберегти</n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-spin :show="loading">
      <div class="columns">
        <!-- Left: all clients -->
        <div class="col col--all">
          <div class="col-toolbar">
            <n-input
              v-model:value="search"
              clearable
              placeholder="Пошук клієнта"
              class="search"
            >
              <template #prefix><n-icon><SearchOutline /></n-icon></template>
            </n-input>
            <n-select
              v-model:value="statusFilter"
              :options="STATUS_OPTIONS"
              clearable
              placeholder="Статус"
              style="width: 140px;"
            />
          </div>

          <div class="col-list">
            <n-empty v-if="filteredClients.length === 0" description="Нічого не знайдено" style="margin-top: 40px;" />
            <div
              v-for="client in filteredClients"
              :key="client.id"
              class="client-row"
              :class="{ 'client-row--member': isMember(client.id) }"
            >
              <div class="client-main">
                <span class="client-name">{{ clientTitle(client) }}</span>
                <n-tag :type="statusType(client.status)" size="tiny" :bordered="false">
                  {{ statusLabel(client.status) }}
                </n-tag>
                <span v-if="otherGroupName(client)" class="client-hint">
                  у групі: {{ otherGroupName(client) }}
                </span>
              </div>
              <n-button
                v-if="isMember(client.id)"
                size="small"
                type="success"
                ghost
                @click="toggle(client.id)"
              >
                <template #icon><n-icon><CheckmarkOutline /></n-icon></template>
                У групі
              </n-button>
              <n-button v-else size="small" dashed @click="toggle(client.id)">
                <template #icon><n-icon><AddOutline /></n-icon></template>
                Додати
              </n-button>
            </div>
          </div>
        </div>

        <!-- Right: members of this group -->
        <div class="col col--members">
          <div class="col-header">У групі ({{ members.length }})</div>
          <div class="col-list">
            <n-empty v-if="members.length === 0" description="Ще немає учасників" style="margin-top: 40px;" />
            <div v-for="client in members" :key="client.id" class="member-row">
              <span class="client-name">{{ clientTitle(client) }}</span>
              <n-button size="tiny" quaternary type="error" @click="toggle(client.id)">
                <template #icon><n-icon><CloseOutline /></n-icon></template>
              </n-button>
            </div>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NPageHeader, NButton, NIcon, NInput, NSelect, NTag,
  NSpace, NSpin, NEmpty, useMessage,
} from 'naive-ui'
import { SearchOutline, AddOutline, CheckmarkOutline, CloseOutline } from '@vicons/ionicons5'
import { useClientsStore } from '@/stores/clients.js'
import { useGroupsStore } from '@/stores/groups.js'
import { GroupService } from '@/services/GroupService.js'
import { statusLabel, statusType } from '@/constants/clients.js'

const props = defineProps({
  id: { type: [String, Number], required: true },
})

const router = useRouter()
const message = useMessage()
const clientsStore = useClientsStore()
const groupsStore = useGroupsStore()

const loading = ref(false)
const saving = ref(false)
const search = ref('')
const statusFilter = ref(null)
const memberSet = ref(new Set())

const STATUS_OPTIONS = [
  { label: 'Лід',      value: 'lead' },
  { label: 'Активний', value: 'active' },
  { label: 'Архів',    value: 'inactive' },
]

const groupId = computed(() => Number(props.id))
const group = computed(() => groupsStore.list.find(g => g.id === groupId.value) ?? null)
const title = computed(() => group.value ? `Клієнти групи «${group.value.name}»` : 'Клієнти групи')

const groupNameById = computed(() =>
  Object.fromEntries(groupsStore.list.map(g => [g.id, g.name]))
)

function clientTitle(c) {
  return c.clientType === 'legal' ? c.company : `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim()
}

function otherGroupName(client) {
  if (!client.groupId || client.groupId === groupId.value) return ''
  return groupNameById.value[client.groupId] ?? ''
}

const filteredClients = computed(() => {
  const q = search.value.toLowerCase().trim()
  return clientsStore.list.filter(c => {
    const matchesStatus = !statusFilter.value || c.status === statusFilter.value
    const matchesSearch = !q || [c.firstName, c.lastName, c.company, c.email, c.phone]
      .some(v => v?.toLowerCase().includes(q))
    return matchesStatus && matchesSearch
  })
})

const members = computed(() =>
  clientsStore.list
    .filter(c => memberSet.value.has(c.id))
    .sort((a, b) => clientTitle(a).localeCompare(clientTitle(b), 'uk'))
)

function isMember(id) {
  return memberSet.value.has(id)
}

function toggle(id) {
  const next = new Set(memberSet.value)
  next.has(id) ? next.delete(id) : next.add(id)
  memberSet.value = next
}

async function save() {
  saving.value = true
  try {
    await GroupService.setMembers(groupId.value, [...memberSet.value])
    await clientsStore.fetchAll()
    message.success('Склад групи збережено')
    goBack()
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push({ name: 'groups' })
}

onMounted(async () => {
  loading.value = true
  await Promise.all([
    groupsStore.list.length === 0 ? groupsStore.fetchAll() : Promise.resolve(),
    clientsStore.fetchAll(),
  ])
  memberSet.value = new Set(
    clientsStore.list.filter(c => c.groupId === groupId.value).map(c => c.id)
  )
  loading.value = false
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 1000px;
}

.columns {
  display: flex;
  gap: 16px;
  margin-top: 24px;
  align-items: flex-start;
}

.col {
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.col--all {
  flex: 1;
  min-width: 0;
}

.col--members {
  flex: 0 0 320px;
}

.col-toolbar {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}

.col-toolbar .search {
  flex: 1;
}

.col-header {
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  opacity: 0.7;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}

.col-list {
  max-height: calc(100vh - 240px);
  overflow-y: auto;
  padding: 6px;
}

.client-row,
.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
}

.client-row:hover,
.member-row:hover {
  background: rgba(128, 128, 128, 0.06);
}

.client-row--member {
  background: rgba(24, 160, 88, 0.05);
}

.client-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.client-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-row .client-name {
  flex: 1;
}

.client-hint {
  font-size: 12px;
  opacity: 0.55;
  white-space: nowrap;
}
</style>
