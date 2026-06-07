<template>
  <div>
    <div class="panel-head">
      <span class="panel-title">Шаблони документів</span>
      <n-dropdown trigger="click" :options="entityMenu" @select="createForEntity">
        <n-button type="primary" size="small">
          <template #icon><n-icon><AddOutline /></n-icon></template>
          Новий шаблон
        </n-button>
      </n-dropdown>
    </div>

    <n-empty
      v-if="!loading && store.list.length === 0"
      description="Шаблонів ще немає"
      style="margin-top: 40px;"
    />

    <n-spin :show="loading">
      <n-list bordered style="margin-top: 12px;">
        <n-list-item v-for="t in store.list" :key="t.id">
          <n-thing>
            <template #header>
              <n-space size="small" align="center">
                {{ t.name }}
                <n-tag size="small" round>{{ entityLabel(t.type) }}</n-tag>
                <n-tag v-if="t.isDefault" type="success" size="small" round>Типовий</n-tag>
              </n-space>
            </template>
            <template #header-extra>
              <n-space size="small">
                <n-button size="small" type="primary" quaternary @click="edit(t)">
                  <template #icon><n-icon><CreateOutline /></n-icon></template>
                  Редагувати
                </n-button>
                <n-button size="small" quaternary @click="duplicate(t)">
                  <template #icon><n-icon><CopyOutline /></n-icon></template>
                </n-button>
                <n-button size="small" quaternary :disabled="!!t.isDefault" @click="makeDefault(t)">
                  <template #icon><n-icon><StarOutline /></n-icon></template>
                </n-button>
                <n-button size="small" quaternary type="error" :disabled="(typeCounts[t.type] ?? 0) <= 1" @click="confirmRemove(t)">
                  <template #icon><n-icon><TrashOutline /></n-icon></template>
                </n-button>
              </n-space>
            </template>
            <template #description>
              <n-text depth="3" style="font-size: 13px;">Оновлено {{ formatDate(t.updatedAt) }}</n-text>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton, NIcon, NEmpty, NSpin, NList, NListItem,
  NThing, NSpace, NTag, NText, NDropdown, useMessage, useDialog,
} from 'naive-ui'
import {
  AddOutline, CreateOutline, CopyOutline, TrashOutline, StarOutline,
} from '@vicons/ionicons5'
import { useDocumentTemplatesStore } from '../stores/documentTemplates.js'
import { ENTITY_OPTIONS, getEntity, entityLabel } from '../config/entities.js'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const store = useDocumentTemplatesStore()
const loading = ref(false)

const entityMenu = ENTITY_OPTIONS.map(o => ({ label: o.label, key: o.value }))

// Кількість шаблонів у межах кожного типу — щоб не дати видалити останній
// шаблон сутності (інакше для неї не лишиться жодного для друку).
const typeCounts = computed(() => {
  const m = {}
  for (const t of store.list) m[t.type] = (m[t.type] ?? 0) + 1
  return m
})

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function edit(t) {
  router.push({ name: 'documents-template-edit', params: { id: t.id } })
}

async function createForEntity(entityKey) {
  const ent = getEntity(entityKey)
  const id = await store.create({ type: ent.key, name: `Новий шаблон (${ent.label})`, body: ent.defaultBody })
  router.push({ name: 'documents-template-edit', params: { id } })
}

async function duplicate(t) {
  const id = await store.create({
    type: t.type,
    name: `${t.name} (копія)`,
    body: t.body,
    accentColor: t.accentColor,
    fontFamily: t.fontFamily,
  })
  router.push({ name: 'documents-template-edit', params: { id } })
}

async function makeDefault(t) {
  await store.setDefault(t.id, t.type)
  message.success(`Типовий шаблон для «${entityLabel(t.type)}»`)
}

function confirmRemove(t) {
  dialog.warning({
    title: 'Видалити шаблон?',
    content: `«${t.name}» буде видалено без можливості відновлення.`,
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    onPositiveClick: async () => {
      await store.remove(t.id)
      message.success('Шаблон видалено')
    },
  })
}

onMounted(async () => {
  loading.value = true
  await store.fetchAll()
  loading.value = false
})
</script>

<style scoped>
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.7;
}
</style>
