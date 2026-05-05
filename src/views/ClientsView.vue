<template>
  <div class="view-container">
    <n-page-header title="Клієнти">
      <template #extra>
        <n-button type="primary" @click="$router.push({ name: 'client-new' })">
          <template #icon><n-icon><AddOutline /></n-icon></template>
          Додати клієнта
        </n-button>
      </template>
    </n-page-header>

    <!-- Лічильники статусів -->
    <div class="status-bar" style="margin-top: 16px;">
      <div
        v-for="s in STATUSES"
        :key="s.value"
        class="stat-card"
        :class="{ 'stat-card--active': store.statusFilter === s.value }"
        :style="store.statusFilter === s.value ? { borderBottomColor: s.activeColor } : {}"
        @click="toggleStatus(s.value)"
      >
        <span class="stat-label">{{ s.label }}</span>
        <span class="stat-value" :style="store.statusFilter === s.value ? { color: s.activeColor } : {}">
          {{ store.statusCounts[s.value] }}
        </span>
      </div>
    </div>

    <!-- Пошук і фільтр по тегах -->
    <n-space style="margin-top: 16px;" :wrap="false">
      <n-input
        ref="searchRef"
        v-model:value="store.searchQuery"
        placeholder="Пошук по імені, телефону, email, компанії... (Ctrl+F)"
        clearable
        style="flex: 1;"
      >
        <template #prefix><n-icon><SearchOutline /></n-icon></template>
      </n-input>

      <n-select
        v-model:value="store.tagFilter"
        :options="tagsStore.asOptions"
        :render-label="renderTagOption"
        multiple
        clearable
        placeholder="Фільтр по тегах"
        style="width: 240px;"
      />
    </n-space>

    <div v-if="!store.isLoading && store.filtered.length === 0" class="empty-state">
      <n-icon size="56" depth="4">
        <PeopleOutline />
      </n-icon>
      <template v-if="store.list.length === 0">
        <p class="empty-title">Ще немає жодного клієнта</p>
        <n-button type="primary" @click="$router.push({ name: 'client-new' })">
          Додати першого клієнта
        </n-button>
      </template>
      <template v-else>
        <p class="empty-title">Нічого не знайдено</p>
        <n-button @click="resetFilters">Скинути фільтри</n-button>
      </template>
    </div>

    <n-spin :show="store.isLoading" style="margin-top: 24px;">
      <n-list bordered style="margin-top: 16px;">
        <n-list-item
          v-for="client in store.paginated"
          :key="client.id"
          style="cursor: pointer;"
          @click="$router.push({ name: 'client-detail', params: { id: client.id } })"
        >
          <n-thing :title="clientTitle(client)">
            <template #header-extra>
              <n-space size="small">
                <n-tag type="info" size="small">{{ CLIENT_TYPE_LABEL[client.clientType] ?? 'Фіз.' }}</n-tag>
                <n-tag :type="statusType(client.status)" size="small">{{ statusLabel(client.status) }}</n-tag>
              </n-space>
            </template>
            <template #description>
              <n-space size="small" style="margin-top: 4px; flex-wrap: wrap;">
                <span v-if="client.phone" class="meta">{{ client.phone }}</span>
                <span v-if="client.email" class="meta">{{ client.email }}</span>
                <n-tag
                  v-for="tagId in client.tagIds"
                  :key="tagId"
                  size="small"
                  :style="tagStyle(tagId)"
                >
                  {{ tagName(tagId) }}
                </n-tag>
              </n-space>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>

      <n-pagination
        v-if="store.filtered.length > ui.defaultPageSize"
        v-model:page="store.currentPage"
        v-model:page-size="ui.defaultPageSize"
        :item-count="store.filtered.length"
        :page-sizes="[10, 20, 50]"
        show-size-picker
        show-quick-jumper
        style="margin-top: 16px; justify-content: flex-end;"
      />
    </n-spin>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NPageHeader, NButton, NIcon, NInput, NSelect, NList, NListItem, NThing,
  NTag, NSpace, NSpin, NPagination,
} from 'naive-ui'
import { AddOutline, SearchOutline, PeopleOutline } from '@vicons/ionicons5'
import { useClientsStore } from '@/stores/clients.js'
import { useTagsStore } from '@/stores/tags.js'
import { useUiStore } from '@/stores/ui.js'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts.js'
import { statusLabel, statusType, CLIENT_TYPE_LABEL } from '@/constants/clients.js'
import { renderTagOption } from '@/utils/renderTagOption.js'

const router = useRouter()
const store = useClientsStore()
const tagsStore = useTagsStore()
const ui = useUiStore()

const searchRef = ref(null)

useKeyboardShortcuts({
  'ctrl+n': () => router.push({ name: 'client-new' }),
  'ctrl+f': () => searchRef.value?.focus(),
})

const STATUSES = [
  { value: 'active',   label: 'Активні',  activeColor: '#18a058' },
  { value: 'lead',     label: 'Ліди',     activeColor: '#f0a020' },
  { value: 'inactive', label: 'Архів',    activeColor: '#909090' },
]

const clientTitle = c => c.clientType === 'legal' ? c.company : `${c.lastName} ${c.firstName}`

function toggleStatus(val) {
  store.statusFilter = store.statusFilter === val ? null : val
}

function resetFilters() {
  store.searchQuery = ''
  store.statusFilter = null
  store.tagFilter = []
}

function tagName(tagId) {
  return tagsStore.list.find(t => t.id === tagId)?.name ?? ''
}

function tagStyle(tagId) {
  const color = tagsStore.list.find(t => t.id === tagId)?.color ?? '#999'
  return { background: color, color: '#fff', border: 'none' }
}

onMounted(async () => {
  await Promise.all([store.fetchAll(), tagsStore.fetchAll()])
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 900px;
}

.status-bar {
  display: flex;
  gap: 8px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 20px;
  border-radius: 8px;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-width: 90px;
}

.stat-card:hover {
  background: rgba(128, 128, 128, 0.08);
}

.stat-card--active {
  background: rgba(128, 128, 128, 0.1);
}

.stat-label {
  font-size: 12px;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  transition: color 0.15s;
}

.meta {
  font-size: 13px;
  opacity: 0.7;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 80px;
  text-align: center;
}

.empty-title {
  font-size: 15px;
  opacity: 0.6;
  margin: 0;
}
</style>
