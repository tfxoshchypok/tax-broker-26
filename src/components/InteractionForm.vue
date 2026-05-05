<template>
  <n-modal
    :show="show"
    :title="isEdit ? 'Редагувати взаємодію' : 'Нова взаємодія'"
    preset="card"
    style="width: 520px;"
    :mask-closable="false"
    @update:show="$emit('update:show', $event)"
  >
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
      <n-form-item label="Тип" path="type">
        <n-select v-model:value="form.type" :options="typeOptions" />
      </n-form-item>
      <n-form-item label="Тема" path="subject">
        <n-input v-model:value="form.subject" placeholder="Коротко про що..." />
      </n-form-item>
      <n-form-item label="Опис" path="body">
        <n-input v-model:value="form.body" type="textarea" :rows="4" placeholder="Деталі взаємодії..." />
      </n-form-item>
      <n-form-item label="Дата" path="date">
        <n-date-picker
          v-model:value="form.date"
          type="datetime"
          :is-date-disabled="isFutureDate"
          clearable
          style="width: 100%;"
        />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="$emit('update:show', false)">Скасувати</n-button>
        <n-button type="primary" :loading="saving" @click="submit">
          {{ isEdit ? 'Зберегти' : 'Додати' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { NModal, NForm, NFormItem, NInput, NSelect, NButton, NSpace, NDatePicker } from 'naive-ui'

const props = defineProps({
  show:        { type: Boolean, required: true },
  interaction: { type: Object, default: null },
})

const emit = defineEmits(['update:show', 'saved'])

const isEdit = computed(() => !!props.interaction?.id)
const formRef = ref(null)
const saving = ref(false)

const form = reactive({ type: 'call', subject: '', body: '', date: Date.now() })

watch(() => props.show, (val) => {
  if (!val) return
  if (props.interaction) {
    Object.assign(form, props.interaction)
  } else {
    Object.assign(form, { type: 'call', subject: '', body: '', date: Date.now() })
  }
})

const typeOptions = [
  { label: 'Дзвінок',   value: 'call' },
  { label: 'Зустріч',   value: 'meeting' },
  { label: 'Email',     value: 'email' },
  { label: 'Нотатка',   value: 'note' },
]

const rules = {
  type:  { required: true, message: 'Оберіть тип',    trigger: 'change' },
  body:  { required: true, message: 'Введіть опис',   trigger: 'blur' },
  date:  { required: true, type: 'number', message: 'Вкажіть дату', trigger: 'change' },
}

const isFutureDate = ts => ts > Date.now()

async function submit() {
  await formRef.value.validate()
  saving.value = true
  try {
    emit('saved', { ...form })
    emit('update:show', false)
  } finally {
    saving.value = false
  }
}
</script>
