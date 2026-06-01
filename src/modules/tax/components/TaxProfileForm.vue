<template>
  <n-form label-placement="top">

    <!-- Row 1: Система -->
    <n-form-item label="Система оподаткування">
      <n-radio-group v-model:value="form.taxSystem">
        <n-radio-button value="simplified">Спрощена</n-radio-button>
        <n-radio-button value="general">Загальна</n-radio-button>
      </n-radio-group>
    </n-form-item>

    <!-- Row 2: Група (only for simplified) -->
    <n-form-item v-if="form.taxSystem === 'simplified'" label="Група єдиного податку">
      <n-radio-group v-model:value="form.simplifiedGroup">
        <n-space>
          <n-radio :value="1">Група 1</n-radio>
          <n-radio :value="2">Група 2</n-radio>
          <n-radio :value="3">Група 3 (5%, без ПДВ)</n-radio>
          <n-radio value="3vat">Група 3 (3%, з ПДВ)</n-radio>
          <n-radio :value="4">Група 4 (сільгосп)</n-radio>
        </n-space>
      </n-radio-group>
    </n-form-item>

    <!-- Row 3: 2-column switches grid -->
    <div class="switches-grid">
      <!-- Left column -->
      <div class="switches-col">
        <div class="col-label">Загальні</div>
        <div class="switch-row">
          <n-switch v-model:value="form.vatPayer" />
          <span class="switch-label">Платник ПДВ</span>
        </div>
        <div class="switch-row">
          <n-switch v-model:value="form.hasEmployees" />
          <span class="switch-label">Наймані працівники</span>
        </div>
        <div v-if="form.hasEmployees" class="employee-count">
          <span class="switch-label">Кількість найманих:</span>
          <n-input-number v-model:value="form.employeeCount" :min="1" size="small" style="width: 90px;" />
        </div>
      </div>

      <!-- Right column -->
      <div class="switches-col">
        <div class="col-label">Спецподатки</div>
        <n-spin :show="taxTypesLoading" :size="'small'">
          <template v-if="taxTypesList.length === 0 && !taxTypesLoading">
            <n-text depth="3" style="font-size: 13px;">Немає спецподатків</n-text>
          </template>
          <div
            v-for="taxType in taxTypesList"
            :key="taxType.key"
            class="switch-row"
          >
            <n-switch
              :value="form.specialTaxes.includes(taxType.key)"
              @update:value="toggleSpecialTax(taxType.key, $event)"
            />
            <span class="switch-label">{{ taxType.name }}</span>
          </div>
        </n-spin>
      </div>
    </div>

    <n-space justify="end" style="margin-top: 20px;">
      <n-button v-if="hasProfile" @click="$emit('cancel')">Скасувати</n-button>
      <n-button type="primary" :loading="saving" @click="submit">Зберегти</n-button>
    </n-space>

  </n-form>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { NForm, NFormItem, NRadioGroup, NRadioButton, NRadio, NSwitch, NInputNumber, NButton, NSpace, NSpin, NText } from 'naive-ui'
import { useSpecialTaxTypesStore } from '../stores/specialTaxTypes.js'

const props = defineProps({
  profile: { type: Object, default: null },
})

const emit = defineEmits(['save', 'cancel'])

const hasProfile = computed(() => !!props.profile)
const saving = ref(false)
const taxTypesLoading = ref(false)

const taxTypesStore = useSpecialTaxTypesStore()
const taxTypesList = computed(() => taxTypesStore.list.filter(t => t.active))

const DEFAULTS = {
  taxSystem: 'simplified',
  simplifiedGroup: 3,
  vatPayer: false,
  hasEmployees: false,
  employeeCount: 0,
  specialTaxes: [],
}

const form = reactive({ ...DEFAULTS, specialTaxes: [] })

watch(() => props.profile, (p) => {
  const base = p ? { ...DEFAULTS, ...p } : { ...DEFAULTS }
  Object.assign(form, base)
  form.specialTaxes = Array.isArray(p?.specialTaxes) ? [...p.specialTaxes] : []
}, { immediate: true })

function toggleSpecialTax(key, enabled) {
  if (enabled) {
    if (!form.specialTaxes.includes(key)) form.specialTaxes.push(key)
  } else {
    form.specialTaxes = form.specialTaxes.filter(k => k !== key)
  }
}

async function submit() {
  saving.value = true
  try {
    emit('save', { ...form, specialTaxes: [...form.specialTaxes] })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (taxTypesStore.list.length === 0) {
    taxTypesLoading.value = true
    await taxTypesStore.fetchAll()
    taxTypesLoading.value = false
  }
})
</script>

<style scoped>
.switches-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 40px;
  margin-top: 4px;
}

.switches-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.col-label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.45;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.switch-label {
  font-size: 14px;
}

.employee-count {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 46px;
}
</style>
