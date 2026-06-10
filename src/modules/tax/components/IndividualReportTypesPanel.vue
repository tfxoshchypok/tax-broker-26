<template>
  <div>
    <div class="panel-intro">
      <n-text depth="3" style="font-size: 13px;">
        Типи звітів із ручним графіком: дедлайн і період виставляються персонально кожному клієнту
        на сторінці його податків. Напр. щоквартальний внесок за ліцензію (акциз).
      </n-text>
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
            <template #header>
              {{ item.name }}
              <n-text depth="3" style="font-size: 12px; font-weight: 400;">· {{ item.shortName }}</n-text>
            </template>
            <template #description>
              <n-space size="small" align="center" :wrap-item="false">
                <n-tag size="small" :bordered="false">{{ categoryLabel(item.category) }}</n-tag>
                <n-tag size="small" :bordered="false" :type="item.mode === 'periodic' ? 'info' : 'default'">
                  {{ item.mode === 'periodic' ? `Періодичний · кожні ${item.intervalMonths} міс.` : 'Одноразовий' }}
                </n-tag>
              </n-space>
            </template>
            <template #header-extra>
              <n-space size="small" align="center">
                <n-switch :value="item.active" size="small" @update:value="toggleActive(item)" />
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
      :title="editing ? 'Редагувати тип' : 'Новий індивідуальний звіт'"
      preset="card"
      style="width: 460px;"
      :mask-closable="false"
    >
      <n-form label-placement="top">
        <n-form-item label="Назва" :validation-status="nameError ? 'error' : undefined" :feedback="nameError">
          <n-input v-model:value="form.name" placeholder="Напр.: Акцизний внесок за ліцензію" @input="nameError = ''" />
        </n-form-item>
        <n-form-item label="Скорочення" :validation-status="shortError ? 'error' : undefined" :feedback="shortError">
          <n-input v-model:value="form.shortName" placeholder="Напр.: Акциз внесок" @input="shortError = ''" />
        </n-form-item>
        <n-form-item label="Категорія">
          <n-select v-model:value="form.category" :options="CATEGORY_OPTIONS" />
        </n-form-item>
        <n-form-item label="Режим">
          <n-radio-group v-model:value="form.mode">
            <n-radio-button value="one_off">Одноразовий</n-radio-button>
            <n-radio-button value="periodic">Періодичний</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item v-if="form.mode === 'periodic'" label="Повторювати кожні (місяців)">
          <n-input-number v-model:value="form.intervalMonths" :min="1" :max="60" style="width: 140px;" />
          <n-text depth="3" style="font-size: 12px; margin-left: 10px;">3 = щокварталу, 12 = щороку</n-text>
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
  NButton, NIcon, NList, NListItem, NThing, NText, NSpin, NEmpty, NTag,
  NSwitch, NModal, NForm, NFormItem, NInput, NInputNumber, NSelect,
  NRadioGroup, NRadioButton, NSpace, useDialog, useMessage,
} from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5'
import { useIndividualReportTypesStore } from '../stores/individualReportTypes.js'
import { IndividualReportTypeService } from '../services/IndividualReportTypeService.js'
import { REPORT_CATEGORY_OPTIONS, reportCategoryLabel } from '../config/reportCategories.js'

const store = useIndividualReportTypesStore()
const dialog = useDialog()
const message = useMessage()

const CATEGORY_OPTIONS = REPORT_CATEGORY_OPTIONS
const categoryLabel = reportCategoryLabel

const loading = ref(false)
const formVisible = ref(false)
const saving = ref(false)
const editing = ref(null)
const nameError = ref('')
const shortError = ref('')

const DEFAULTS = { name: '', shortName: '', category: 'other', mode: 'one_off', intervalMonths: 3 }
const form = reactive({ ...DEFAULTS })

function openCreate() {
  editing.value = null
  Object.assign(form, DEFAULTS)
  nameError.value = ''
  shortError.value = ''
  formVisible.value = true
}

function openEdit(item) {
  editing.value = item
  Object.assign(form, { ...DEFAULTS, ...item, intervalMonths: item.intervalMonths ?? 3 })
  nameError.value = ''
  shortError.value = ''
  formVisible.value = true
}

async function save() {
  if (!form.name.trim()) { nameError.value = 'Введіть назву'; return }
  if (!form.shortName.trim()) { shortError.value = 'Введіть скорочення'; return }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      category: form.category,
      mode: form.mode,
      intervalMonths: form.mode === 'periodic' ? form.intervalMonths : null,
    }
    if (editing.value) {
      await store.update(editing.value.id, payload)
      message.success('Тип оновлено')
    } else {
      await store.create({ key: 'ind_' + Date.now(), active: true, ...payload })
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
  if (await IndividualReportTypeService.isReferenced(item.id)) {
    message.error('Неможливо видалити: тип призначено клієнтам')
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

<style scoped>
.panel-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 16px;
}
</style>
