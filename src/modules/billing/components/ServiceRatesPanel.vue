<template>
  <div>
    <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
      <n-button type="primary" size="small" @click="showAddForm = true">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        Додати свою
      </n-button>
    </div>

    <n-spin :show="loading">
      <div class="rates-section">
        <div v-for="rate in standardRates" :key="rate.id" class="rate-row">
          <div class="rate-main">
            <n-button text size="tiny" class="history-toggle" @click="toggleHistory(rate.id)">
              <template #icon>
                <n-icon>
                  <ChevronForwardOutline v-if="expandedId !== rate.id" />
                  <ChevronDownOutline v-else />
                </n-icon>
              </template>
            </n-button>

            <n-input
              :value="rate.name"
              size="small"
              class="rate-name-input"
              @blur="e => saveField(rate, 'name', e.target.value)"
            />

            <n-input-number
              :value="getPriceLocal(rate)"
              size="small"
              :min="0"
              :precision="2"
              style="width: 110px;"
              @update:value="val => updatePriceLocal(rate, val)"
              @blur="() => savePriceOnBlur(rate)"
            >
              <template #suffix>грн</template>
            </n-input-number>

            <div class="rate-switches">
              <n-tooltip>
                <template #trigger>
                  <div class="switch-wrap">
                    <span class="switch-label">Активна</span>
                    <n-switch :value="rate.active" size="small" @update:value="val => saveField(rate, 'active', val)" />
                  </div>
                </template>
                Ставка застосовується
              </n-tooltip>
              <n-tooltip>
                <template #trigger>
                  <div class="switch-wrap">
                    <span class="switch-label">Авто</span>
                    <n-switch :value="rate.autoInclude" :disabled="!rate.active" size="small" @update:value="val => saveField(rate, 'autoInclude', val)" />
                  </div>
                </template>
                Включати автоматично при генерації рахунку
              </n-tooltip>
            </div>
          </div>

          <div v-if="expandedId === rate.id" class="rate-history">
            <n-spin :show="historyLoading[rate.id]">
              <template v-if="!historyLoading[rate.id]">
                <div v-if="!store.historyByRateId[rate.id]?.length" class="history-empty">Змін не було</div>
                <n-timeline v-else size="small">
                  <n-timeline-item
                    v-for="(entry, idx) in store.historyByRateId[rate.id]"
                    :key="entry.id"
                    :time="formatDate(entry.changedAt)"
                  >
                    <div v-for="field in entry.changedFields" :key="field" class="history-change">
                      {{ formatChange(field, entry.snapshot[field], getNewValue(field, idx, rate, store.historyByRateId[rate.id])) }}
                    </div>
                  </n-timeline-item>
                </n-timeline>
              </template>
            </n-spin>
          </div>
        </div>
      </div>

      <template v-if="customRates.length > 0">
        <n-divider>Власні послуги</n-divider>
        <div v-for="rate in customRates" :key="rate.id" class="rate-row">
          <div class="rate-main">
            <div style="width: 20px;" />
            <n-input :value="rate.name" size="small" class="rate-name-input" @blur="e => saveField(rate, 'name', e.target.value)" />
            <n-input-number
              :value="getPriceLocal(rate)"
              size="small"
              :min="0"
              :precision="2"
              style="width: 110px;"
              @update:value="val => updatePriceLocal(rate, val)"
              @blur="() => savePriceOnBlur(rate)"
            >
              <template #suffix>грн</template>
            </n-input-number>
            <div class="rate-switches">
              <div class="switch-wrap">
                <span class="switch-label">Активна</span>
                <n-switch :value="rate.active" size="small" @update:value="val => saveField(rate, 'active', val)" />
              </div>
              <div class="switch-wrap">
                <span class="switch-label">Авто</span>
                <n-switch :value="rate.autoInclude" :disabled="!rate.active" size="small" @update:value="val => saveField(rate, 'autoInclude', val)" />
              </div>
            </div>
            <n-button text size="small" type="error" @click="removeRate(rate.id)">
              <template #icon><n-icon><TrashOutline /></n-icon></template>
            </n-button>
          </div>
        </div>
      </template>
    </n-spin>

    <n-modal v-model:show="showAddForm" title="Нова послуга" preset="dialog" :show-icon="false">
      <n-form :model="addForm" style="margin-top: 8px;">
        <n-form-item label="Назва">
          <n-input v-model:value="addForm.name" placeholder="Назва послуги" />
        </n-form-item>
        <n-form-item label="Ціна (грн)">
          <n-input-number v-model:value="addForm.price" :min="0" :precision="2" style="width: 100%;" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showAddForm = false">Скасувати</n-button>
        <n-button type="primary" :disabled="!addForm.name" @click="confirmAdd">Додати</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  NButton, NIcon, NSpin, NDivider, NModal, NForm, NFormItem,
  NInput, NInputNumber, NSwitch, NTooltip, NTimeline, NTimelineItem,
  useMessage, useDialog,
} from 'naive-ui'
import { AddOutline, TrashOutline, ChevronForwardOutline, ChevronDownOutline } from '@vicons/ionicons5'
import { useServiceRatesStore } from '../stores/serviceRates.js'

const store = useServiceRatesStore()
const message = useMessage()
const dialog = useDialog()

const loading        = ref(false)
const expandedId     = ref(null)
const historyLoading = ref({})
const showAddForm    = ref(false)
const addForm        = ref({ name: '', price: 0 })
const localPrices    = ref({})

const standardRates = computed(() => store.rates.filter(r => r.ruleId !== null && r.ruleId !== undefined))
const customRates   = computed(() => store.rates.filter(r => r.ruleId === null || r.ruleId === undefined))

async function toggleHistory(rateId) {
  if (expandedId.value === rateId) { expandedId.value = null; return }
  expandedId.value = rateId
  if (!store.historyByRateId[rateId]) {
    historyLoading.value[rateId] = true
    await store.loadHistory(rateId)
    historyLoading.value[rateId] = false
  }
}

async function saveField(rate, field, value) {
  if (rate[field] === value) return
  await store.save(rate.id, { ...rate, [field]: value })
  if (expandedId.value === rate.id) {
    historyLoading.value[rate.id] = true
    await store.loadHistory(rate.id)
    historyLoading.value[rate.id] = false
  }
}

function getPriceLocal(rate)          { return localPrices.value[rate.id] ?? rate.price }
function updatePriceLocal(rate, val)  { if (val !== null && val !== undefined) localPrices.value[rate.id] = val }

async function savePriceOnBlur(rate) {
  const val = localPrices.value[rate.id]
  if (val === undefined) return
  await saveField(rate, 'price', val)
  delete localPrices.value[rate.id]
}

async function removeRate(id) {
  dialog.warning({
    title: 'Видалити послугу?',
    content: 'Послугу буде видалено з прайсу.',
    positiveText: 'Видалити',
    negativeText: 'Скасувати',
    async onPositiveClick() {
      await store.remove(id)
      message.success('Послугу видалено')
    },
  })
}

async function confirmAdd() {
  if (!addForm.value.name) return
  await store.add({ name: addForm.value.name, price: addForm.value.price, active: true, autoInclude: false })
  showAddForm.value = false
  addForm.value = { name: '', price: 0 }
  message.success('Послугу додано')
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getNewValue(field, idx, rate, history) {
  return idx === 0 ? rate[field] : history[idx - 1].snapshot[field]
}

function formatChange(field, oldVal, newVal) {
  if (field === 'price')       return `ціна: ${oldVal} грн → ${newVal} грн`
  if (field === 'name')        return `назва: "${oldVal}" → "${newVal}"`
  if (field === 'active')      return newVal ? 'активовано' : 'деактивовано'
  if (field === 'autoInclude') return newVal ? 'включено в авто' : 'виключено з авто'
  return `${field}: ${oldVal} → ${newVal}`
}

onMounted(async () => {
  loading.value = true
  await store.load()
  loading.value = false
})
</script>

<style scoped>
.rates-section { display: flex; flex-direction: column; gap: 2px; }
.rate-row      { border-radius: 6px; overflow: hidden; }

.rate-main {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  border-radius: 6px;
  transition: background 0.15s;
}
.rate-main:hover { background: rgba(128, 128, 128, 0.06); }

.history-toggle  { flex-shrink: 0; }
.rate-name-input { flex: 1; }

.rate-switches {
  display: flex;
  gap: 16px;
  flex-shrink: 0;
}

.switch-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.switch-label { font-size: 12px; opacity: 0.65; }

.rate-history {
  padding: 8px 8px 8px 32px;
  background: rgba(128, 128, 128, 0.04);
  border-radius: 0 0 6px 6px;
  border-top: 1px solid rgba(128, 128, 128, 0.1);
}

.history-empty   { font-size: 13px; opacity: 0.45; padding: 4px 0; }
.history-change  { font-size: 13px; }
</style>
