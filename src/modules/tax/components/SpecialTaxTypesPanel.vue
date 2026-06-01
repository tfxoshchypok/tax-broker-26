<template>
  <div>
    <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        Новий тип
      </n-button>
    </div>

    <n-spin :show="loading">
      <n-empty
        v-if="!loading && store.list.length === 0"
        description="Список порожній"
        style="margin-top: 40px;"
      />

      <n-list v-else bordered>
        <n-list-item v-for="item in store.list" :key="item.id">
          <n-thing>
            <template #header>{{ item.name }}</template>
            <template #description>
              <n-text depth="3" style="font-size: 12px;">{{ item.key }}</n-text>
            </template>
            <template #header-extra>
              <n-space size="small" align="center">
                <n-switch
                  :value="item.active"
                  size="small"
                  @update:value="toggleActive(item)"
                />
                <n-button size="small" quaternary @click="openEdit(item)">
                  <template #icon><n-icon><CreateOutline /></n-icon></template>
                </n-button>
                <n-button size="small" quaternary type="error" @click="confirmDelete(item)">
                  <template #icon><n-icon><TrashOutline /></n-icon></template>
                </n-button>
              </n-space>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-spin>

    <n-modal
      v-model:show="formVisible"
      :title="editing ? 'Редагувати тип' : 'Новий тип спецподатку'"
      preset="card"
      style="width: 420px;"
      :mask-closable="false"
    >
      <n-form label-placement="top">
        <n-form-item label="Назва" :validation-status="nameError ? 'error' : undefined" :feedback="nameError">
          <n-input v-model:value="form.name" placeholder="Наприклад: Туристичний збір" @input="nameError = ''" />
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
  NButton, NIcon, NList, NListItem, NThing, NText, NSpin, NEmpty,
  NSwitch, NModal, NForm, NFormItem, NInput, NSpace, useDialog, useMessage,
} from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5'
import { useSpecialTaxTypesStore } from '../stores/specialTaxTypes.js'
import { SpecialTaxTypesService } from '../services/SpecialTaxTypesService.js'

const store = useSpecialTaxTypesStore()
const dialog = useDialog()
const message = useMessage()

const loading = ref(false)
const formVisible = ref(false)
const saving = ref(false)
const editing = ref(null)
const nameError = ref('')

const form = reactive({ name: '' })

function openCreate() {
  editing.value = null
  form.name = ''
  nameError.value = ''
  formVisible.value = true
}

function openEdit(item) {
  editing.value = item
  form.name = item.name
  nameError.value = ''
  formVisible.value = true
}

async function save() {
  if (!form.name.trim()) {
    nameError.value = "Введіть назву"
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await store.update(editing.value.id, { name: form.name.trim() })
      message.success('Тип оновлено')
    } else {
      const key = 'stt_' + Date.now()
      await store.create({ key, name: form.name.trim(), active: true })
      message.success('Тип створено')
    }
    formVisible.value = false
  } finally {
    saving.value = false
  }
}

async function toggleActive(item) {
  await store.update(item.id, { active: !item.active })
}

async function confirmDelete(item) {
  const referenced = await SpecialTaxTypesService.isReferenced(item.key)
  if (referenced) {
    message.error('Неможливо видалити: тип використовується в профілях клієнтів або правилах звітів')
    return
  }
  dialog.warning({
    title: `Видалити «${item.name}»?`,
    content: 'Тип буде видалено без можливості відновлення.',
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await store.remove(item.id)
      message.success('Тип видалено')
    },
  })
}

onMounted(async () => {
  loading.value = true
  await store.fetchAll()
  loading.value = false
})
</script>
