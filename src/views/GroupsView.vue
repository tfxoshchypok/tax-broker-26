<template>
  <div class="view-container">
    <n-page-header title="Групи">
      <template #extra>
        <n-button type="primary" @click="openCreate">
          <template #icon><n-icon><AddOutline /></n-icon></template>
          Нова група
        </n-button>
      </template>
    </n-page-header>

    <n-empty
      v-if="!loading && groupsStore.list.length === 0"
      description="Груп ще немає"
      style="margin-top: 64px;"
    />

    <n-spin :show="loading">
      <n-list bordered style="margin-top: 24px;">
        <n-list-item v-for="group in groupsStore.list" :key="group.id">
          <n-thing>
            <template #header>{{ group.name }}</template>
            <template #header-extra>
              <n-space size="small">
                <n-text depth="3" style="font-size: 13px;">
                  {{ clientCounts[group.id] ?? 0 }} {{ pluralClient(clientCounts[group.id] ?? 0) }}
                </n-text>
                <n-button size="small" quaternary @click="openEdit(group)">
                  <template #icon><n-icon><CreateOutline /></n-icon></template>
                </n-button>
                <n-button size="small" quaternary type="error" @click="confirmDelete(group)">
                  <template #icon><n-icon><TrashOutline /></n-icon></template>
                </n-button>
              </n-space>
            </template>
            <template #description>
              <n-space size="small" style="margin-top: 4px;">
                <span v-if="group.contactPerson" class="meta">{{ group.contactPerson }}</span>
                <span v-if="group.contactPhone" class="meta">{{ group.contactPhone }}</span>
              </n-space>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-spin>

    <n-modal
      v-model:show="formVisible"
      :title="editing ? 'Редагувати групу' : 'Нова група'"
      preset="card"
      style="width: 420px;"
      :mask-closable="false"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="Назва групи" path="name">
          <n-input v-model:value="form.name" placeholder="ТОВ Ромашка" @keydown.enter="save" />
        </n-form-item>
        <n-form-item label="Контактна особа" path="contactPerson">
          <n-input v-model:value="form.contactPerson" placeholder="Іванов Іван" />
        </n-form-item>
        <n-form-item label="Контактний телефон" path="contactPhone">
          <n-input v-model:value="form.contactPhone" placeholder="+380501234567" />
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
import { useGroupsStore } from '@/stores/groups.js'
import { GroupService } from '@/services/GroupService.js'

const groupsStore = useGroupsStore()
const dialog = useDialog()
const message = useMessage()

const loading = ref(false)
const clientCounts = ref({})
const formVisible = ref(false)
const saving = ref(false)
const editing = ref(null)
const formRef = ref(null)

const form = reactive({ name: '', contactPerson: '', contactPhone: '' })

const rules = {
  name: { required: true, message: 'Введіть назву групи', trigger: 'blur' },
}

function pluralClient(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'клієнт'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'клієнти'
  return 'клієнтів'
}

async function load() {
  loading.value = true
  await groupsStore.fetchAll()
  clientCounts.value = await GroupService.getClientCounts()
  loading.value = false
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', contactPerson: '', contactPhone: '' })
  formVisible.value = true
}

function openEdit(group) {
  editing.value = group
  Object.assign(form, {
    name: group.name,
    contactPerson: group.contactPerson ?? '',
    contactPhone: group.contactPhone ?? '',
  })
  formVisible.value = true
}

async function save() {
  await formRef.value.validate()
  saving.value = true
  try {
    const data = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      contactPhone: form.contactPhone.trim(),
    }
    if (editing.value) {
      await groupsStore.update(editing.value.id, data)
      message.success('Групу оновлено')
    } else {
      await groupsStore.create(data)
      message.success('Групу створено')
    }
    formVisible.value = false
    clientCounts.value = await GroupService.getClientCounts()
  } finally {
    saving.value = false
  }
}

function confirmDelete(group) {
  const count = clientCounts.value[group.id] ?? 0
  const warning = count > 0
    ? `Групу буде знято з ${count} ${pluralClient(count)}. Клієнти не будуть видалені.`
    : 'Група не має жодного клієнта.'

  dialog.warning({
    title: `Видалити групу «${group.name}»?`,
    content: warning,
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await groupsStore.remove(group.id)
      clientCounts.value = await GroupService.getClientCounts()
      message.success('Групу видалено')
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

.meta {
  font-size: 13px;
  opacity: 0.7;
}
</style>
