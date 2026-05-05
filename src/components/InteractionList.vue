<template>
  <div>
    <div class="list-header">
      <span class="list-title">Взаємодії</span>
      <n-button size="small" type="primary" @click="openCreate">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        Додати
      </n-button>
    </div>

    <n-empty v-if="!loading && items.length === 0" description="Взаємодій ще немає" style="margin-top: 24px;" />

    <n-spin :show="loading">
      <n-timeline style="margin-top: 16px; padding-left: 4px;">
        <n-timeline-item
          v-for="item in items"
          :key="item.id"
          :type="typeColor(item.type)"
          :time="formatDate(item.date)"
        >
          <template #icon>
            <n-icon size="16">
              <component :is="typeIcon(item.type)" />
            </n-icon>
          </template>

          <div class="interaction-card">
            <div class="interaction-top">
              <span class="interaction-type">{{ typeLabel(item.type) }}</span>
              <n-space size="small">
                <n-button text size="small" @click="openEdit(item)">
                  <template #icon><n-icon><CreateOutline /></n-icon></template>
                </n-button>
                <n-button text size="small" type="error" @click="confirmDelete(item)">
                  <template #icon><n-icon><TrashOutline /></n-icon></template>
                </n-button>
              </n-space>
            </div>
            <div v-if="item.subject" class="interaction-subject">{{ item.subject }}</div>
            <div class="interaction-body">{{ item.body }}</div>
          </div>
        </n-timeline-item>
      </n-timeline>
    </n-spin>

    <InteractionForm
      v-model:show="formVisible"
      :interaction="editing"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  NButton, NIcon, NSpin, NEmpty, NSpace, NTimeline, NTimelineItem,
} from 'naive-ui'
import { useDialog, useMessage } from 'naive-ui'
import {
  AddOutline, CreateOutline, TrashOutline,
  CallOutline, PeopleOutline, MailOutline, DocumentTextOutline,
} from '@vicons/ionicons5'
import InteractionForm from './InteractionForm.vue'
import { InteractionService } from '@/services/InteractionService.js'

const props = defineProps({ clientId: { type: [Number, String], required: true } })

const dialog  = useDialog()
const message = useMessage()

const items   = ref([])
const loading = ref(false)
const formVisible = ref(false)
const editing = ref(null)

const TYPE_MAP = {
  call:    { label: 'Дзвінок',  color: 'success', icon: CallOutline },
  meeting: { label: 'Зустріч',  color: 'info',    icon: PeopleOutline },
  email:   { label: 'Email',    color: 'warning',  icon: MailOutline },
  note:    { label: 'Нотатка',  color: 'default',  icon: DocumentTextOutline },
}

const typeLabel = t => TYPE_MAP[t]?.label ?? t
const typeColor = t => TYPE_MAP[t]?.color ?? 'default'
const typeIcon  = t => TYPE_MAP[t]?.icon  ?? DocumentTextOutline

function formatDate(ts) {
  return new Date(ts).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

async function load() {
  loading.value = true
  try {
    items.value = await InteractionService.getByClientId(props.clientId)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  formVisible.value = true
}

function openEdit(item) {
  editing.value = { ...item }
  formVisible.value = true
}

async function onSaved(data) {
  if (data.id) {
    await InteractionService.update(data.id, data)
    message.success('Збережено')
  } else {
    await InteractionService.create({ ...data, clientId: props.clientId })
    message.success('Взаємодію додано')
  }
  await load()
}

function confirmDelete(item) {
  dialog.warning({
    title: 'Видалити взаємодію?',
    content: item.subject || typeLabel(item.type),
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await InteractionService.remove(item.id)
      message.success('Видалено')
      await load()
    },
  })
}

onMounted(load)
</script>

<style scoped>
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 32px;
  margin-bottom: 4px;
}

.list-title {
  font-size: 16px;
  font-weight: 600;
}

.interaction-card {
  padding: 4px 0;
}

.interaction-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.interaction-type {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.6;
}

.interaction-subject {
  font-weight: 500;
  margin-top: 2px;
}

.interaction-body {
  margin-top: 4px;
  white-space: pre-wrap;
  opacity: 0.85;
}
</style>
