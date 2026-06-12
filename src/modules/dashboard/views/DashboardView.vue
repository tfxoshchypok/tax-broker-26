<template>
  <div class="view-container">
    <n-page-header title="Дашборд" />

    <div class="toolbar" style="margin-top: 16px;">
      <div class="month-nav">
        <n-button text @click="store.prevMonth()">
          <template #icon><n-icon><ChevronBackOutline /></n-icon></template>
        </n-button>
        <span class="month-label" :class="{ 'month-label--current': isCurrentMonth }">{{ monthLabel }}</span>
        <n-button text @click="store.nextMonth()">
          <template #icon><n-icon><ChevronForwardOutline /></n-icon></template>
        </n-button>
      </div>
    </div>

    <n-spin :show="store.loading" style="margin-top: 20px;">
      <!-- KPI-картки -->
      <div class="kpi-grid">
        <div class="kpi-card kpi-card--accent">
          <span class="kpi-label">Отримано (місяць)</span>
          <span class="kpi-value">{{ formatPrice(store.revenueReceived) }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Виставлено (місяць)</span>
          <span class="kpi-value">{{ formatPrice(store.revenueBilled) }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Дохід за {{ store.year }} рік</span>
          <span class="kpi-value">{{ formatPrice(store.revenueYear) }}</span>
        </div>
        <div class="kpi-card kpi-card--warn">
          <span class="kpi-label">Загальний борг</span>
          <span class="kpi-value">{{ formatPrice(store.debtTotal) }}</span>
        </div>
      </div>

      <!-- Лічильники -->
      <div class="counter-grid">
        <div class="counter" @click="$router.push({ name: 'tax-dashboard' })">
          <span class="counter-num" :class="{ 'counter-num--alert': store.overdueCount > 0 }">{{ store.overdueCount }}</span>
          <span class="counter-label">Прострочені звіти</span>
        </div>
        <div class="counter" @click="$router.push({ name: 'billing-dashboard' })">
          <span class="counter-num">{{ store.unpaidCount }}</span>
          <span class="counter-label">Неоплачені рахунки</span>
        </div>
        <div class="counter" @click="$router.push({ name: 'clients' })">
          <span class="counter-num">{{ store.leadCount }}</span>
          <span class="counter-label">Нові ліди</span>
        </div>
      </div>

      <!-- Графік доходу -->
      <div class="section">
        <h3 class="section-title">Динаміка доходу</h3>
        <KpiSvgChart :series="store.revenueSeries" />
      </div>

      <div class="two-col">
        <!-- Що зробити сьогодні -->
        <div class="section">
          <h3 class="section-title">Що зробити сьогодні</h3>
          <n-empty v-if="store.todoItems.length === 0" description="Все під контролем" size="small" style="padding: 24px 0;" />
          <div v-else class="list">
            <div
              v-for="item in store.todoItems"
              :key="item.id"
              class="list-row"
              @click="openTodo(item)"
            >
              <span class="dot" :class="item.kind === 'report' ? 'dot--report' : 'dot--invoice'" />
              <div class="list-main">
                <span class="list-title">{{ item.title }}</span>
                <span class="list-sub">{{ item.subtitle }}</span>
              </div>
              <span v-if="item.amount != null" class="list-amount">{{ formatPrice(item.amount) }}</span>
            </div>
          </div>
        </div>

        <!-- Боржники -->
        <div class="section">
          <h3 class="section-title">Боржники</h3>
          <n-empty v-if="store.topDebtors.length === 0" description="Боргів немає" size="small" style="padding: 24px 0;" />
          <div v-else class="list">
            <div
              v-for="d in store.topDebtors"
              :key="d.clientId"
              class="list-row"
              @click="$router.push({ name: 'client-detail', params: { id: d.clientId } })"
            >
              <div class="list-main">
                <span class="list-title">{{ d.name }}</span>
                <span class="list-sub">виставлено {{ formatPrice(d.billed) }} · сплачено {{ formatPrice(d.paid) }}</span>
              </div>
              <span class="list-amount list-amount--debt">{{ formatPrice(d.debt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NPageHeader, NButton, NIcon, NSpin, NEmpty } from 'naive-ui'
import { ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { useDashboardStore } from '../stores/dashboardStore.js'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts.js'
import KpiSvgChart from '../components/KpiSvgChart.vue'

const router = useRouter()
const store = useDashboardStore()

const UA_MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']
const monthLabel = computed(() => `${UA_MONTHS[store.month - 1]} ${store.year}`)

const isCurrentMonth = computed(() => {
  const now = new Date()
  return store.year === now.getFullYear() && store.month === now.getMonth() + 1
})

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}

function openTodo(item) {
  if (item.kind === 'invoice') {
    router.push({ name: 'billing-invoice', params: { id: item.invoiceId } })
  } else {
    router.push({ name: 'tax-dashboard' })
  }
}

useKeyboardShortcuts({
  arrowleft: () => store.prevMonth(),
  arrowright: () => store.nextMonth(),
})

onMounted(() => store.refresh())
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 900px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.month-label {
  font-size: 15px;
  font-weight: 500;
  min-width: 140px;
  text-align: center;
}

.month-label--current {
  color: var(--brand-color, #18a058);
  font-weight: 600;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.03);
}

.kpi-card--accent {
  border-left: 4px solid var(--brand-color, #18a058);
}

.kpi-card--warn {
  border-left: 4px solid #d03050;
}

.kpi-label {
  font-size: 12px;
  opacity: 0.65;
}

.kpi-value {
  font-size: 22px;
  font-weight: 600;
}

.counter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px;
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.counter:hover {
  background: rgba(128, 128, 128, 0.06);
}

.counter-num {
  font-size: 26px;
  font-weight: 700;
}

.counter-num--alert {
  color: #d03050;
}

.counter-label {
  font-size: 12px;
  opacity: 0.65;
}

.section {
  margin-top: 28px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  opacity: 0.8;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 720px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

.list {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 8px;
  overflow: hidden;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid rgba(128, 128, 128, 0.08);
}

.list-row:last-child {
  border-bottom: none;
}

.list-row:hover {
  background: rgba(128, 128, 128, 0.06);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--report {
  background: #d03050;
}

.dot--invoice {
  background: #f0a020;
}

.list-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.list-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-sub {
  font-size: 12px;
  opacity: 0.6;
}

.list-amount {
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.list-amount--debt {
  color: #d03050;
}
</style>
