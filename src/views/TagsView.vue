<template>
  <div class="view-container">
    <n-page-header title="Теги">
      <template #extra>
        <n-button type="primary" @click="openCreate">
          <template #icon><n-icon><AddOutline /></n-icon></template>
          Новий тег
        </n-button>
      </template>
    </n-page-header>

    <n-empty
      v-if="!loading && tagsStore.list.length === 0"
      description="Тегів ще немає"
      style="margin-top: 64px;"
    />

    <n-spin :show="loading">
      <n-list bordered style="margin-top: 24px;">
        <n-list-item v-for="tag in tagsStore.list" :key="tag.id">
          <n-thing>
            <template #avatar>
              <div class="color-dot" :style="{ background: tag.color }" />
            </template>
            <template #header>{{ tag.name }}</template>
            <template #header-extra>
              <n-space size="small">
                <n-text depth="3" style="font-size: 13px;">
                  {{ clientCounts[tag.id] ?? 0 }} {{ pluralClient(clientCounts[tag.id] ?? 0) }}
                </n-text>
                <n-button size="small" quaternary @click="openEdit(tag)">
                  <template #icon><n-icon><CreateOutline /></n-icon></template>
                </n-button>
                <n-button size="small" quaternary type="error" @click="confirmDelete(tag)">
                  <template #icon><n-icon><TrashOutline /></n-icon></template>
                </n-button>
              </n-space>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-spin>

    <!-- Модалка створення / редагування -->
    <n-modal
      v-model:show="formVisible"
      :title="editing ? 'Редагувати тег' : 'Новий тег'"
      preset="card"
      style="width: 380px;"
      :mask-closable="false"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="Назва" path="name">
          <n-input v-model:value="form.name" placeholder="Важливий клієнт" @keydown.enter="save" />
        </n-form-item>
        <n-form-item label="Колір">
          <n-space>
            <div
              v-for="color in PALETTE"
              :key="color"
              class="color-swatch"
              :style="{ background: color, outline: form.color === color ? '2px solid #555' : 'none' }"
              @click="form.color = color"
            />
          </n-space>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="formVisible = false">Скасувати</n-button>
          <n-button type="primary" :loading="saving" @click="save">
            {{ editing ? 'Зберегти' : 'Створити' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  NPageHeader, NButton, NIcon, NList, NListItem, NThing, NText,
  NSpace, NSpin, NEmpty, NModal, NForm, NFormItem, NInput,
} from 'naive-ui'
import { useDialog, useMessage } from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5'
import { useTagsStore } from '@/stores/tags.js'
import { TagService } from '@/services/TagService.js'
import { TAG_PALETTE as PALETTE } from '@/constants/tags.js'

const tagsStore = useTagsStore()
const dialog = useDialog()
const message = useMessage()

const loading = ref(false)
const clientCounts = ref({})
const formVisible = ref(false)
const saving = ref(false)
const editing = ref(null)
const formRef = ref(null)

const form = reactive({ name: '', color: PALETTE[4] })

const rules = {
  name: { required: true, message: 'Введіть назву тегу', trigger: 'blur' },
}

function pluralClient(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'клієнт'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'клієнти'
  return 'клієнтів'
}

async function load() {
  loading.value = true
  await tagsStore.fetchAll()
  clientCounts.value = await TagService.getClientCounts()
  loading.value = false
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', color: PALETTE[4] })
  formVisible.value = true
}

function openEdit(tag) {
  editing.value = tag
  Object.assign(form, { name: tag.name, color: tag.color })
  formVisible.value = true
}

async function save() {
  await formRef.value.validate()
  saving.value = true
  try {
    if (editing.value) {
      await tagsStore.update(editing.value.id, form.name.trim(), form.color)
      message.success('Тег оновлено')
    } else {
      await tagsStore.create(form.name.trim(), form.color)
      message.success('Тег створено')
    }
    formVisible.value = false
    clientCounts.value = await TagService.getClientCounts()
  } finally {
    saving.value = false
  }
}

function confirmDelete(tag) {
  const count = clientCounts.value[tag.id] ?? 0
  const warning = count > 0
    ? `Тег буде знятий з ${count} ${pluralClient(count)}.`
    : 'Тег не використовується жодним клієнтом.'

  dialog.warning({
    title: `Видалити тег «${tag.name}»?`,
    content: warning,
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await tagsStore.remove(tag.id)
      clientCounts.value = await TagService.getClientCounts()
      message.success('Тег видалено')
    },
  })
}

onMounted(load)
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 700px;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

.color-swatch:hover {
  transform: scale(1.2);
}
</style>
