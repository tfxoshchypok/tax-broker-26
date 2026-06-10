<template>
  <div>
    <div class="sub-header">
      <span class="sub-label">Індивідуальні звіти</span>
      <n-button size="small" :disabled="activeTypes.length === 0" @click="openCreate">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        Додати
      </n-button>
      <n-text v-if="activeTypes.length === 0" depth="3" style="font-size: 12px;">
        Спершу створіть тип у Налаштуваннях → Індивідуальні звіти
      </n-text>
    </div>

    <n-empty
      v-if="assignments.length === 0"
      description="Немає призначених індивідуальних звітів"
      size="small"
      style="margin: 8px 0;"
    />
    <div v-else class="assignment-list">
      <div v-for="a in assignments" :key="a.id" class="assignment-row">
        <span class="a-name">{{ typeName(a.typeId) }}</span>
        <n-tag v-if="typeMode(a.typeId) === 'periodic'" size="small" type="info" :bordered="false">
          кожні {{ typeInterval(a.typeId) }} міс.
        </n-tag>
        <span class="a-due">{{ typeMode(a.typeId) === 'periodic' ? 'від' : 'до' }} {{ formatDate(a.dueDate) }}</span>
        <span class="a-lead">показ за {{ a.leadDays }} дн.</span>
        <div class="a-actions">
          <n-button text size="small" @click="openEdit(a)">
            <template #icon><n-icon><CreateOutline /></n-icon></template>
          </n-button>
          <n-button text size="small" type="error" @click="$emit('delete', a.id)">
            <template #icon><n-icon><TrashOutline /></n-icon></template>
          </n-button>
        </div>
      </div>
    </div>

    <n-modal
      v-model:show="formVisible"
      :title="editing ? 'Редагувати призначення' : 'Новий індивідуальний звіт'"
      preset="card"
      style="width: 420px;"
      :mask-closable="false"
    >
      <n-form label-placement="top">
        <n-form-item label="Тип звіту">
          <n-select v-model:value="form.typeId" :options="typeOptions" :disabled="!!editing" />
        </n-form-item>
        <n-form-item :label="anchorLabel">
          <n-date-picker v-model:value="form.dueDate" type="date" style="width: 100%;" />
        </n-form-item>
        <n-form-item label="Показувати за скільки днів до терміну">
          <n-input-number v-model:value="form.leadDays" :min="0" :max="365" style="width: 140px;" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="formVisible = false">Скасувати</n-button>
          <n-button type="primary" :disabled="!canSave" @click="save">
            {{ editing ? 'Зберегти' : 'Додати' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import {
  NButton, NIcon, NTag, NText, NEmpty, NModal, NForm, NFormItem,
  NSelect, NDatePicker, NInputNumber, NSpace,
} from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5'

const props = defineProps({
  assignments: { type: Array, default: () => [] },
  types: { type: Array, default: () => [] },
})

const emit = defineEmits(['create', 'update', 'delete'])

const byId = computed(() => Object.fromEntries(props.types.map(t => [t.id, t])))
const activeTypes = computed(() => props.types.filter(t => t.active))
const typeOptions = computed(() => activeTypes.value.map(t => ({ label: `${t.name} · ${t.shortName}`, value: t.id })))

function typeName(id) { return byId.value[id]?.name ?? '—' }
function typeMode(id) { return byId.value[id]?.mode }
function typeInterval(id) { return byId.value[id]?.intervalMonths }

const formVisible = ref(false)
const editing = ref(null)
const form = reactive({ typeId: null, dueDate: null, leadDays: 14 })

const anchorLabel = computed(() =>
  byId.value[form.typeId]?.mode === 'periodic' ? 'Дата першого внеску (далі повторюється)' : 'Дата дедлайну'
)
const canSave = computed(() => form.typeId != null && form.dueDate != null)

function openCreate() {
  editing.value = null
  form.typeId = activeTypes.value[0]?.id ?? null
  form.dueDate = Date.now()
  form.leadDays = 14
  formVisible.value = true
}

function openEdit(a) {
  editing.value = a
  form.typeId = a.typeId
  form.dueDate = a.dueDate
  form.leadDays = a.leadDays
  formVisible.value = true
}

function save() {
  if (!canSave.value) return
  const data = { typeId: form.typeId, dueDate: form.dueDate, leadDays: form.leadDays }
  if (editing.value) {
    emit('update', { id: editing.value.id, data: { dueDate: data.dueDate, leadDays: data.leadDays } })
  } else {
    emit('create', data)
  }
  formVisible.value = false
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
</script>

<style scoped>
.sub-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  margin-bottom: 8px;
}

.sub-label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.assignment-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.assignment-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.15s;
}

.assignment-row:hover {
  background: rgba(128, 128, 128, 0.06);
}

.a-name {
  font-weight: 500;
  min-width: 160px;
}

.a-due {
  font-size: 13px;
  opacity: 0.7;
}

.a-lead {
  font-size: 12px;
  opacity: 0.5;
}

.a-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
</style>
