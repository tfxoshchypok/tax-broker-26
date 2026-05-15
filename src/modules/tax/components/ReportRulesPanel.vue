<template>
  <div>
    <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        Новий звіт
      </n-button>
    </div>

    <n-spin :show="loading">
      <n-empty
        v-if="!loading && store.list.length === 0"
        description="Довідник порожній"
        style="margin-top: 40px;"
      />

      <n-list v-else bordered>
        <n-list-item v-for="rule in store.list" :key="rule.id">
          <n-thing>
            <template #header>
              <n-space size="small" align="center">
                <span>{{ rule.name }}</span>
                <n-tag size="small" round>{{ rule.shortName }}</n-tag>
                <n-tag size="small" :type="categoryType(rule.category)">{{ categoryLabel(rule.category) }}</n-tag>
                <n-tag size="small" type="default">{{ frequencyLabel(rule.frequency) }}</n-tag>
              </n-space>
            </template>
            <template #description>
              <n-space size="small" style="margin-top: 4px;">
                <n-text depth="3" style="font-size: 13px;">{{ describeDeadline(rule) }}</n-text>
                <n-text depth="3" style="font-size: 13px;">·</n-text>
                <n-text depth="3" style="font-size: 13px;">{{ describeCondition(rule) }}</n-text>
              </n-space>
            </template>
            <template #header-extra>
              <n-space size="small" align="center">
                <n-switch
                  :value="rule.active"
                  size="small"
                  @update:value="toggleActive(rule)"
                />
                <n-button size="small" quaternary @click="openEdit(rule)">
                  <template #icon><n-icon><CreateOutline /></n-icon></template>
                </n-button>
                <n-button size="small" quaternary type="error" @click="confirmDelete(rule)">
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
      :title="editing ? 'Редагувати звіт' : 'Новий звіт'"
      preset="card"
      style="width: 600px;"
      :mask-closable="false"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">

        <!-- Основне -->
        <n-grid :cols="2" :x-gap="16">
          <n-form-item-gi label="Назва" path="name" :span="2">
            <n-input v-model:value="form.name" placeholder="Декларація ЄП (Група 1)" />
          </n-form-item-gi>
          <n-form-item-gi label="Скорочена назва" path="shortName">
            <n-input v-model:value="form.shortName" placeholder="ЄП гр.1" />
          </n-form-item-gi>
          <n-form-item-gi label="Категорія" path="category">
            <n-select v-model:value="form.category" :options="CATEGORY_OPTIONS" />
          </n-form-item-gi>
        </n-grid>

        <!-- Частота і терміни -->
        <n-divider title-placement="left" style="margin: 4px 0 12px;">Частота і термін</n-divider>

        <n-form-item label="Частота подачі" path="frequency">
          <n-radio-group v-model:value="form.frequency" @update:value="onFrequencyChange">
            <n-radio-button value="monthly">Щомісяця</n-radio-button>
            <n-radio-button value="quarterly">Щокварталу</n-radio-button>
            <n-radio-button value="annual">Щорічно</n-radio-button>
            <n-radio-button value="fixed_dates">Фіксовані дати</n-radio-button>
          </n-radio-group>
        </n-form-item>

        <!-- monthly -->
        <n-form-item v-if="form.frequency === 'monthly'" label="День подачі (наступного місяця)" path="dlDay">
          <n-input-number v-model:value="form.dlDay" :min="1" :max="31" style="width: 120px;" />
        </n-form-item>

        <!-- quarterly -->
        <n-form-item v-if="form.frequency === 'quarterly'" label="Днів після закінчення кварталу" path="dlDays">
          <n-input-number v-model:value="form.dlDays" :min="1" :max="90" style="width: 120px;" />
        </n-form-item>

        <!-- annual -->
        <n-grid v-if="form.frequency === 'annual'" :cols="2" :x-gap="16">
          <n-form-item-gi label="Місяць дедлайну" path="dlMonth">
            <n-select v-model:value="form.dlMonth" :options="MONTH_OPTIONS" style="width: 180px;" />
          </n-form-item-gi>
          <n-form-item-gi label="День дедлайну" path="dlDay">
            <n-input-number v-model:value="form.dlDay" :min="1" :max="31" style="width: 120px;" />
          </n-form-item-gi>
        </n-grid>

        <!-- fixed_dates -->
        <n-form-item v-if="form.frequency === 'fixed_dates'" label="Дати подачі">
          <div style="width: 100%;">
            <div
              v-for="(d, i) in form.dlDates"
              :key="i"
              style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"
            >
              <n-select v-model:value="d.month" :options="MONTH_OPTIONS" style="width: 160px;" />
              <n-input-number v-model:value="d.day" :min="1" :max="31" placeholder="День" style="width: 100px;" />
              <n-button size="small" quaternary type="error" @click="removeDate(i)">
                <template #icon><n-icon><CloseOutline /></n-icon></template>
              </n-button>
            </div>
            <n-button size="small" dashed @click="addDate">+ Додати дату</n-button>
          </div>
        </n-form-item>

        <!-- Умова застосування -->
        <n-divider title-placement="left" style="margin: 4px 0 12px;">Умова застосування</n-divider>

        <n-form-item label="Тип клієнта">
          <n-radio-group v-model:value="form.condClientType">
            <n-radio-button :value="null">Будь-який</n-radio-button>
            <n-radio-button value="fop">ФОП</n-radio-button>
            <n-radio-button value="legal">Юридична особа</n-radio-button>
          </n-radio-group>
        </n-form-item>

        <n-form-item label="Система оподаткування">
          <n-radio-group v-model:value="form.condTaxSystem" @update:value="onTaxSystemChange">
            <n-radio-button :value="null">Будь-яка</n-radio-button>
            <n-radio-button value="simplified">Спрощена</n-radio-button>
            <n-radio-button value="general">Загальна</n-radio-button>
          </n-radio-group>
        </n-form-item>

        <n-form-item v-if="form.condTaxSystem === 'simplified'" label="Група ЄП">
          <n-checkbox-group v-model:value="form.condGroups">
            <n-space>
              <n-checkbox v-for="g in GROUP_OPTIONS" :key="g.value" :value="g.value">{{ g.label }}</n-checkbox>
            </n-space>
          </n-checkbox-group>
        </n-form-item>

        <n-form-item label="Додаткові умови">
          <div class="flags-grid">
            <div class="flag-row">
              <n-switch v-model:value="form.condVatPayer" size="small" />
              <span>Платник ПДВ</span>
            </div>
            <div class="flag-row">
              <n-switch v-model:value="form.condHasEmployees" size="small" />
              <span>Наймані працівники</span>
            </div>
            <div class="flag-row">
              <n-switch v-model:value="form.condExciseTax" size="small" />
              <span>Акцизний податок</span>
            </div>
            <div class="flag-row">
              <n-switch v-model:value="form.condLandTax" size="small" />
              <span>Плата за землю</span>
            </div>
            <div class="flag-row">
              <n-switch v-model:value="form.condEnvironmentalTax" size="small" />
              <span>Екологічний податок</span>
            </div>
            <div class="flag-row">
              <n-switch v-model:value="form.condRentTax" size="small" />
              <span>Рентна плата</span>
            </div>
          </div>
        </n-form-item>

        <n-divider title-placement="left" style="margin: 4px 0 12px;">Послуга</n-divider>

        <n-form-item label="Вартість оформлення (грн)">
          <n-input-number v-model:value="form.price" :min="0" :precision="0" style="width: 160px;">
            <template #suffix>грн</template>
          </n-input-number>
        </n-form-item>

        <n-form-item label="Активний">
          <n-switch v-model:value="form.active" />
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
  NButton, NIcon, NList, NListItem, NThing, NText, NTag,
  NSpace, NSpin, NEmpty, NSwitch, NModal, NForm, NFormItem,
  NFormItemGi, NInput, NInputNumber, NSelect, NRadioGroup,
  NRadioButton, NCheckbox, NCheckboxGroup, NDivider, NGrid,
  useDialog, useMessage,
} from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline, CloseOutline } from '@vicons/ionicons5'
import { useReportRulesStore } from '../stores/reportRules.js'
import { BillingService } from '@/modules/billing/services/BillingService.js'

const store = useReportRulesStore()
const dialog = useDialog()
const message = useMessage()

const loading = ref(false)
const formVisible = ref(false)
const saving = ref(false)
const editing = ref(null)
const formRef = ref(null)

const CATEGORY_OPTIONS = [
  { label: 'Прибуток',      value: 'income' },
  { label: 'ПДВ+акциз',    value: 'vat_excise' },
  { label: 'Місцеві',      value: 'local' },
  { label: 'Ресурсні',     value: 'resource' },
  { label: 'Рентні',       value: 'rent' },
  { label: 'Фінзвітність', value: 'financial' },
  { label: 'ЄСВ',          value: 'esv' },
  { label: 'Інші',         value: 'other' },
]

const CATEGORY_LABELS = {
  income:    'Прибуток',
  vat_excise: 'ПДВ+акциз',
  local:     'Місцеві',
  resource:  'Ресурсні',
  rent:      'Рентні',
  financial: 'Фінзвітність',
  esv:       'ЄСВ',
  other:     'Інші',
}

const CATEGORY_TYPES = {
  income:    'success',
  vat_excise: 'warning',
  local:     'info',
  resource:  'primary',
  rent:      'default',
  financial: 'info',
  esv:       'error',
  other:     'default',
}

const FREQUENCY_LABELS = {
  monthly: 'Щомісяця', quarterly: 'Щокварталу',
  annual: 'Щорічно', fixed_dates: 'Фіксовані дати',
}

const MONTH_OPTIONS = [
  { label: 'Січень', value: 1 }, { label: 'Лютий', value: 2 },
  { label: 'Березень', value: 3 }, { label: 'Квітень', value: 4 },
  { label: 'Травень', value: 5 }, { label: 'Червень', value: 6 },
  { label: 'Липень', value: 7 }, { label: 'Серпень', value: 8 },
  { label: 'Вересень', value: 9 }, { label: 'Жовтень', value: 10 },
  { label: 'Листопад', value: 11 }, { label: 'Грудень', value: 12 },
]

const GROUP_OPTIONS = [
  { label: 'Група 1', value: 1 },
  { label: 'Група 2', value: 2 },
  { label: 'Група 3 (5%, без ПДВ)', value: 3 },
  { label: 'Група 3 з ПДВ (3%)', value: '3vat' },
  { label: 'Група 4 (сільгосп)', value: 4 },
]

const EMPTY_FORM = () => ({
  name: '',
  shortName: '',
  category: 'income',
  frequency: 'annual',
  active: true,
  price: 0,
  dlDay: 28,
  dlMonth: 2,
  dlDays: 40,
  dlDates: [],
  condClientType: null,
  condTaxSystem: null,
  condGroups: [],
  condVatPayer: false,
  condHasEmployees: false,
  condExciseTax: false,
  condLandTax: false,
  condEnvironmentalTax: false,
  condRentTax: false,
})

const form = reactive(EMPTY_FORM())

const rules = {
  name:      { required: true, message: "Введіть назву", trigger: 'blur' },
  shortName: { required: true, message: "Введіть скорочену назву", trigger: 'blur' },
}

function categoryLabel(cat) { return CATEGORY_LABELS[cat] ?? cat }
function categoryType(cat)  { return CATEGORY_TYPES[cat] ?? 'default' }
function frequencyLabel(f)  { return FREQUENCY_LABELS[f] ?? f }

function describeDeadline(rule) {
  const d = rule.deadline
  if (rule.frequency === 'monthly')     return `до ${d.day}-го числа наст. місяця`
  if (rule.frequency === 'quarterly')   return `до ${d.value} дн. після кварталу`
  if (rule.frequency === 'annual')      return `до ${d.day}.${String(d.month).padStart(2,'0')} щорічно`
  if (rule.frequency === 'fixed_dates') {
    return 'дати: ' + d.dates.map(x => `${x.day}.${String(x.month).padStart(2,'0')}`).join(', ')
  }
  return ''
}

const CLIENT_TYPE_LABELS = { fop: 'ФОП', legal: 'юр. особа', individual: 'фіз. особа' }

function describeCondition(rule) {
  const c = rule.condition
  const parts = []
  if (c.clientType)        parts.push(CLIENT_TYPE_LABELS[c.clientType] ?? c.clientType)
  if (c.taxSystem === 'simplified') {
    parts.push(c.simplifiedGroup?.length ? `спрощена гр.${c.simplifiedGroup.join('/')}` : 'спрощена')
  } else if (c.taxSystem === 'general') {
    parts.push('загальна')
  }
  if (c.vatPayer)          parts.push('ПДВ')
  if (c.hasEmployees)      parts.push('наймані')
  if (c.exciseTax)         parts.push('акциз')
  if (c.landTax)           parts.push('земля')
  if (c.environmentalTax)  parts.push('еко')
  if (c.rentTax)           parts.push('рента')
  return parts.length > 0 ? parts.join(', ') : 'всі клієнти'
}

function onFrequencyChange(val) {
  if (val === 'fixed_dates' && form.dlDates.length === 0) {
    form.dlDates = [{ month: 1, day: 15 }]
  }
}

function onTaxSystemChange(val) {
  if (val !== 'simplified') form.condGroups = []
}

function addDate() {
  form.dlDates.push({ month: 1, day: 15 })
}

function removeDate(i) {
  form.dlDates.splice(i, 1)
}

function buildRecord() {
  let deadline
  if (form.frequency === 'monthly')     deadline = { type: 'day_of_next_month',   day: form.dlDay }
  if (form.frequency === 'quarterly')   deadline = { type: 'days_after_period_end', value: form.dlDays }
  if (form.frequency === 'annual')      deadline = { type: 'fixed_date',            month: form.dlMonth, day: form.dlDay }
  if (form.frequency === 'fixed_dates') deadline = { type: 'fixed_dates',           dates: form.dlDates.map(d => ({ ...d })) }

  const condition = {
    clientType:      form.condClientType,
    taxSystem:       form.condTaxSystem,
    simplifiedGroup: form.condTaxSystem === 'simplified' && form.condGroups.length > 0
      ? [...form.condGroups]
      : null,
    vatPayer:          form.condVatPayer       || null,
    hasEmployees:      form.condHasEmployees   || null,
    exciseTax:         form.condExciseTax      || null,
    landTax:           form.condLandTax        || null,
    environmentalTax:  form.condEnvironmentalTax || null,
    rentTax:           form.condRentTax        || null,
  }

  return { name: form.name.trim(), shortName: form.shortName.trim(), category: form.category, frequency: form.frequency, active: form.active, deadline, condition }
}

function applyRecord(rule) {
  form.name      = rule.name
  form.shortName = rule.shortName
  form.category  = rule.category
  form.frequency = rule.frequency
  form.active    = rule.active

  const d = rule.deadline
  form.dlDay    = d.day   ?? 20
  form.dlMonth  = d.month ?? 1
  form.dlDays   = d.value ?? 40
  form.dlDates  = d.dates ? d.dates.map(x => ({ ...x })) : []

  const c = rule.condition
  form.condClientType         = c.clientType         ?? null
  form.condTaxSystem          = c.taxSystem          ?? null
  form.condGroups             = c.simplifiedGroup     ? [...c.simplifiedGroup] : []
  form.condVatPayer           = !!c.vatPayer
  form.condHasEmployees       = !!c.hasEmployees
  form.condExciseTax          = !!c.exciseTax
  form.condLandTax            = !!c.landTax
  form.condEnvironmentalTax   = !!c.environmentalTax
  form.condRentTax            = !!c.rentTax
}

function openCreate() {
  editing.value = null
  Object.assign(form, EMPTY_FORM())
  formVisible.value = true
}

async function openEdit(rule) {
  editing.value = rule
  applyRecord(rule)
  const allRates = await BillingService.getAllRates()
  const rate = allRates.find(r => r.ruleId === rule.ruleId)
  form.price = rate?.price ?? 0
  formVisible.value = true
}

async function save() {
  saving.value = true
  try {
    await formRef.value.validate()

    if (form.frequency === 'fixed_dates' && form.dlDates.length === 0) {
      message.error('Додайте хоча б одну дату подачі')
      return
    }

    const data = buildRecord()
    if (editing.value) {
      await store.update(editing.value.id, data)
      const allRates = await BillingService.getAllRates()
      const rate = allRates.find(r => r.ruleId === editing.value.ruleId)
      if (rate) {
        await BillingService.saveRate(rate.id, { ...rate, price: form.price })
      } else {
        await BillingService.addRate({ ruleId: editing.value.ruleId, name: data.name, price: form.price, active: true, autoInclude: true })
      }
      message.success('Звіт оновлено')
    } else {
      const ruleId = `custom_${Date.now()}`
      await store.create({ ...data, ruleId })
      await BillingService.addRate({ ruleId, name: data.name, price: form.price, active: true, autoInclude: true })
      message.success('Звіт створено')
    }
    formVisible.value = false
  } finally {
    saving.value = false
  }
}

async function toggleActive(rule) {
  await store.update(rule.id, { active: !rule.active })
}

function confirmDelete(rule) {
  dialog.warning({
    title: `Видалити «${rule.name}»?`,
    content: 'Правило буде видалено з довідника. Вже збережені статуси звітів у клієнтів залишаться.',
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await store.remove(rule.id)
      message.success('Звіт видалено')
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
.flags-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 32px;
  width: 100%;
}

.flag-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
</style>
