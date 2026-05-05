<template>
  <div class="view-container">
    <n-page-header :title="isEdit ? 'Редагувати клієнта' : 'Новий клієнт'" @back="goBack" />

    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      style="margin-top: 24px;"
    >
      <n-grid :cols="2" :x-gap="16">
        <n-form-item-gi :span="2" label="Тип клієнта" path="clientType">
          <n-radio-group v-model:value="form.clientType">
            <n-radio-button value="individual">Фізична особа</n-radio-button>
            <n-radio-button value="fop">ФОП</n-radio-button>
            <n-radio-button value="legal">Юридична особа</n-radio-button>
          </n-radio-group>
        </n-form-item-gi>

        <template v-if="form.clientType === 'legal'">
          <n-form-item-gi :span="2" label="Назва організації" path="company">
            <n-input v-model:value="form.company" placeholder="ТОВ Ромашка" />
          </n-form-item-gi>
          <n-form-item-gi label="Контактна особа (прізвище)" path="lastName">
            <n-input v-model:value="form.lastName" placeholder="Іванов" />
          </n-form-item-gi>
          <n-form-item-gi label="Контактна особа (ім'я)" path="firstName">
            <n-input v-model:value="form.firstName" placeholder="Іван" />
          </n-form-item-gi>
        </template>

        <template v-else-if="form.clientType === 'fop'">
          <n-form-item-gi label="Прізвище" path="lastName">
            <n-input v-model:value="form.lastName" placeholder="Іванов" />
          </n-form-item-gi>
          <n-form-item-gi label="Ім'я" path="firstName">
            <n-input v-model:value="form.firstName" placeholder="Іван" />
          </n-form-item-gi>
        </template>

        <template v-else>
          <n-form-item-gi label="Прізвище" path="lastName">
            <n-input v-model:value="form.lastName" placeholder="Іванов" />
          </n-form-item-gi>
          <n-form-item-gi label="Ім'я" path="firstName">
            <n-input v-model:value="form.firstName" placeholder="Іван" />
          </n-form-item-gi>
          <n-form-item-gi label="Компанія" path="company">
            <n-input v-model:value="form.company" placeholder="ТОВ Ромашка" />
          </n-form-item-gi>
          <n-form-item-gi label="Посада" path="position">
            <n-input v-model:value="form.position" placeholder="Директор" />
          </n-form-item-gi>
        </template>

        <n-form-item-gi label="Телефон" path="phone">
          <n-input v-model:value="form.phone" placeholder="+380501234567" />
        </n-form-item-gi>
        <n-form-item-gi label="Email" path="email">
          <n-input v-model:value="form.email" placeholder="ivan@example.com" />
        </n-form-item-gi>
        <n-form-item-gi label="Статус" path="status">
          <n-select v-model:value="form.status" :options="statusOptions" />
        </n-form-item-gi>
        <n-form-item-gi label="Адреса" path="address">
          <n-input v-model:value="form.address" placeholder="м. Київ, вул. ..." />
        </n-form-item-gi>
        <n-form-item-gi :span="2" label="Нотатки" path="notes">
          <n-input v-model:value="form.notes" type="textarea" :rows="3" placeholder="Додаткова інформація..." />
        </n-form-item-gi>
      </n-grid>

      <n-space style="margin-top: 8px;">
        <n-button type="primary" :loading="saving" @click="submit">
          {{ isEdit ? 'Зберегти' : 'Створити' }}
        </n-button>
        <n-button @click="goBack">Скасувати</n-button>
      </n-space>
    </n-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NPageHeader, NForm, NFormItemGi, NGrid, NInput, NSelect, NButton, NSpace,
  NRadioGroup, NRadioButton,
} from 'naive-ui'
import { useMessage } from 'naive-ui'
import { useClientsStore } from '@/stores/clients.js'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts.js'

const props = defineProps({ id: { type: String, default: null } })
const router = useRouter()
const store = useClientsStore()
const message = useMessage()

const isEdit = computed(() => !!props.id)
const formRef = ref(null)
const saving = ref(false)

const form = reactive({
  clientType: 'individual',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  company: '',
  position: '',
  address: '',
  notes: '',
  status: 'lead',
})

const statusOptions = [
  { label: 'Лід',      value: 'lead' },
  { label: 'Активний', value: 'active' },
  { label: 'Архів',    value: 'inactive' },
]

const rules = computed(() => ({
  company: form.clientType === 'legal'
    ? { required: true, message: 'Вкажіть назву організації', trigger: 'blur' }
    : {},
  lastName: ['individual', 'fop'].includes(form.clientType)
    ? { required: true, message: 'Вкажіть прізвище', trigger: 'blur' }
    : {},
  firstName: ['individual', 'fop'].includes(form.clientType)
    ? { required: true, message: "Вкажіть ім'я", trigger: 'blur' }
    : {},
  phone: { required: true, message: 'Вкажіть телефон', trigger: 'blur' },
  email: {
    trigger: 'blur',
    validator: (_, v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || new Error('Невірний формат email'),
  },
}))

async function submit() {
  await formRef.value.validate()
  saving.value = true
  try {
    if (isEdit.value) {
      await store.update(props.id, { ...form })
      message.success('Збережено')
      router.push({ name: 'client-detail', params: { id: props.id } })
    } else {
      const id = await store.create({ ...form })
      message.success('Клієнта додано')
      router.push({ name: 'client-detail', params: { id } })
    }
  } finally {
    saving.value = false
  }
}

function goBack() {
  if (isEdit.value) router.push({ name: 'client-detail', params: { id: props.id } })
  else router.push({ name: 'clients' })
}

useKeyboardShortcuts({ 'escape': goBack })

onMounted(async () => {
  if (isEdit.value) {
    const client = await store.getById(props.id)
    if (client) Object.assign(form, client)
  }
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 760px;
}
</style>
