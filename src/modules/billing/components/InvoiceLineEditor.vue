<template>
  <div class="line-editor">
    <n-data-table
      :columns="columns"
      :data="lines"
      :row-key="row => row.id ?? row._key"
      size="small"
      :bordered="true"
      :single-line="false"
    />

    <div v-if="!readonly" class="line-editor-footer">
      <div class="footer-actions">
        <n-button text size="small" @click="$emit('add-line')">
          <template #icon><n-icon><AddOutline /></n-icon></template>
          Вручну
        </n-button>
        <n-button v-if="rates.length" text size="small" @click="openCatalog">
          <template #icon><n-icon><ListOutline /></n-icon></template>
          З довідника
        </n-button>
      </div>
      <div class="line-total">
        Разом: <strong>{{ formatPrice(total) }}</strong>
      </div>
    </div>
    <div v-else class="line-editor-footer">
      <div class="line-total">
        Разом: <strong>{{ formatPrice(total) }}</strong>
      </div>
    </div>

    <n-modal
      v-model:show="showCatalogModal"
      title="Вибрати послугу з довідника"
      preset="dialog"
      :show-icon="false"
      style="width: 420px;"
    >
      <n-select
        v-model:value="selectedRateId"
        :options="catalogSelectOptions"
        filterable
        clearable
        placeholder="Оберіть або введіть назву..."
        style="margin-top: 8px;"
      />
      <template #action>
        <n-button @click="showCatalogModal = false">Скасувати</n-button>
        <n-button type="primary" :disabled="!selectedRateId" @click="confirmCatalogPick">Додати</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, h, ref } from 'vue'
import {
  NDataTable, NCheckbox, NInputNumber, NAutoComplete, NButton, NIcon, NTooltip,
  NModal, NSelect,
} from 'naive-ui'
import { AddOutline, TrashOutline, ListOutline } from '@vicons/ionicons5'

const props = defineProps({
  lines:    { type: Array,   required: true },
  readonly: { type: Boolean, default: false },
  rates:    { type: Array,   default: () => [] },
})

const emit = defineEmits(['update:line', 'add-line', 'remove-line', 'add-from-rate'])

const editingCell       = ref(null) // { id, field }
const showCatalogModal  = ref(false)
const selectedRateId    = ref(null)

const catalogSelectOptions = computed(() =>
  props.rates.map(r => ({ label: r.name, value: r.id }))
)

function openCatalog() {
  selectedRateId.value = null
  showCatalogModal.value = true
}

function confirmCatalogPick() {
  const rate = props.rates.find(r => r.id === selectedRateId.value)
  if (rate) emit('add-from-rate', rate)
  showCatalogModal.value = false
  selectedRateId.value = null
}

function isEditing(id, field) {
  return editingCell.value?.id === id && editingCell.value?.field === field
}

function startEdit(id, field) {
  if (!props.readonly) editingCell.value = { id, field }
}

function stopEdit() {
  editingCell.value = null
}

function update(id, field, value) {
  emit('update:line', { id, field, value })
}

function lineTotal(line) {
  if (!line.included) return 0
  return line.finalPrice ?? (line.qty * line.unitPrice)
}

const total = computed(() => props.lines.reduce((s, l) => s + lineTotal(l), 0))

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}

const catalogOptions = computed(() =>
  props.rates.map(r => ({ label: r.name, value: r.name }))
)

const columns = computed(() => {
  const cols = [
    {
      key: 'included',
      title: '',
      width: 36,
      render(row) {
        if (props.readonly) {
          return h(NCheckbox, { checked: row.included, disabled: true })
        }
        return h(NCheckbox, {
          checked: row.included,
          onUpdateChecked: val => update(row.id ?? row._key, 'included', val),
        })
      },
    },
    {
      key: 'name',
      title: 'Послуга',
      render(row) {
        const id = row.id ?? row._key
        if (!props.readonly && isEditing(id, 'name')) {
          return h(NAutoComplete, {
            value: row.name,
            options: catalogOptions.value,
            size: 'small',
            clearable: false,
            autofocus: true,
            placeholder: 'Назва або виберіть з довідника',
            onUpdateValue: val => update(id, 'name', val),
            onSelect: val => {
              const rate = props.rates.find(r => r.name === val)
              if (rate) {
                update(id, 'unitPrice', rate.price)
                update(id, 'finalPrice', null)
              }
            },
            onBlur: stopEdit,
          })
        }
        return h('span', {
          class: props.readonly ? '' : 'cell-editable',
          onClick: props.readonly ? undefined : () => startEdit(id, 'name'),
        }, row.name || '—')
      },
    },
    {
      key: 'qty',
      title: 'К-сть',
      width: 80,
      render(row) {
        const id = row.id ?? row._key
        if (!props.readonly && isEditing(id, 'qty')) {
          return h(NInputNumber, {
            value: row.qty,
            size: 'small',
            min: 1,
            autofocus: true,
            style: 'width: 70px',
            onUpdateValue: val => val && update(id, 'qty', val),
            onBlur: stopEdit,
          })
        }
        return h('span', {
          class: props.readonly ? '' : 'cell-editable',
          onClick: props.readonly ? undefined : () => startEdit(id, 'qty'),
        }, row.qty)
      },
    },
    {
      key: 'unitPrice',
      title: 'Ціна',
      width: 110,
      render(row) {
        const id = row.id ?? row._key
        const hasOverride = row.finalPrice !== null && row.finalPrice !== undefined
        if (!props.readonly && isEditing(id, 'finalPrice')) {
          return h(NInputNumber, {
            value: row.finalPrice ?? row.unitPrice,
            size: 'small',
            min: 0,
            autofocus: true,
            style: 'width: 95px',
            onUpdateValue: val => {
              if (val !== null) update(id, 'finalPrice', val === row.unitPrice ? null : val)
            },
            onBlur: stopEdit,
          })
        }
        const displayPrice = row.finalPrice ?? row.unitPrice
        if (hasOverride) {
          return h(NTooltip, null, {
            trigger: () => h('span', {
              class: props.readonly ? 'price-modified' : 'cell-editable price-modified',
              onClick: props.readonly ? undefined : () => startEdit(id, 'finalPrice'),
            }, formatPrice(displayPrice)),
            default: () => `змінено вручну (прайс: ${formatPrice(row.unitPrice)})`,
          })
        }
        return h('span', {
          class: props.readonly ? '' : 'cell-editable',
          onClick: props.readonly ? undefined : () => startEdit(id, 'finalPrice'),
        }, formatPrice(displayPrice))
      },
    },
    {
      key: 'total',
      title: 'Сума',
      width: 110,
      render(row) {
        const val = lineTotal(row)
        return h('span', { class: row.included ? '' : 'total-excluded' },
          row.included ? formatPrice(val) : '—'
        )
      },
    },
  ]

  if (!props.readonly) {
    cols.push({
      key: 'actions',
      title: '',
      width: 40,
      render(row) {
        return h(NButton, {
          text: true,
          size: 'small',
          type: 'error',
          onClick: () => emit('remove-line', { id: row.id ?? row._key }),
        }, { icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) })
      },
    })
  }

  return cols
})
</script>

<style scoped>
.line-editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.footer-actions {
  display: flex;
  gap: 4px;
}

.line-total {
  font-size: 14px;
  margin-left: auto;
}

:deep(.cell-editable) {
  cursor: pointer;
  border-bottom: 1px dashed rgba(128, 128, 128, 0.4);
  padding-bottom: 1px;
}

:deep(.cell-editable:hover) {
  border-bottom-color: #18a058;
  color: #18a058;
}

:deep(.price-modified) {
  color: #d18b00;
}

:deep(.total-excluded) {
  opacity: 0.35;
}
</style>
