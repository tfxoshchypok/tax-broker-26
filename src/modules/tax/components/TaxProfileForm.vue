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
        <div class="switch-row">
          <n-switch v-model:value="form.exciseTax" />
          <span class="switch-label">Акцизний податок</span>
        </div>
        <div class="switch-row">
          <n-switch v-model:value="form.landTax" />
          <span class="switch-label">Плата за землю</span>
        </div>
        <div class="switch-row">
          <n-switch v-model:value="form.environmentalTax" />
          <span class="switch-label">Екологічний податок</span>
        </div>
        <div class="switch-row">
          <n-switch v-model:value="form.rentTax" />
          <span class="switch-label">Рентна плата</span>
        </div>
      </div>
    </div>

    <n-space justify="end" style="margin-top: 20px;">
      <n-button v-if="hasProfile" @click="$emit('cancel')">Скасувати</n-button>
      <n-button type="primary" :loading="saving" @click="submit">Зберегти</n-button>
    </n-space>

  </n-form>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { NForm, NFormItem, NRadioGroup, NRadioButton, NRadio, NSwitch, NInputNumber, NButton, NSpace } from 'naive-ui'

const props = defineProps({
  profile: { type: Object, default: null },
})

const emit = defineEmits(['save', 'cancel'])

const hasProfile = computed(() => !!props.profile)
const saving = ref(false)

const DEFAULTS = {
  taxSystem: 'simplified',
  simplifiedGroup: 3,
  vatPayer: false,
  hasEmployees: false,
  employeeCount: 0,
  exciseTax: false,
  landTax: false,
  environmentalTax: false,
  rentTax: false,
}

const form = reactive({ ...DEFAULTS })

watch(() => props.profile, (p) => {
  Object.assign(form, p ? { ...DEFAULTS, ...p } : { ...DEFAULTS })
}, { immediate: true })

async function submit() {
  saving.value = true
  try {
    emit('save', { ...form })
  } finally {
    saving.value = false
  }
}
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
