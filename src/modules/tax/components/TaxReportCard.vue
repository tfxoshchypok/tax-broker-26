<template>
  <n-card size="small" :class="{ 'card--overdue': isOverdue, 'card--ignored': report.status === 'ignored' }">
    <div class="card-content">
      <div class="card-header">
        <TaxReportStatusBadge :status="report.status" />
        <span class="card-name">{{ report.rule.shortName }}</span>
      </div>

      <div class="card-due" :class="{ 'card-due--overdue': isOverdue }">
        до {{ formatDate(report.dueDate) }}
      </div>
      <div class="card-period">{{ report.period }}</div>

      <div class="card-actions">
        <template v-if="report.status === 'ignored'">
          <n-button size="small" block @click="$emit('reset', report)">
            <template #icon><n-icon><RefreshOutline /></n-icon></template>
            Відновити
          </n-button>
        </template>
        <template v-else-if="report.status === 'submitted'">
          <span class="submitted-text">Здано {{ formatDate(report.instance?.submittedAt) }}</span>
        </template>
        <template v-else>
          <span v-if="report.status === 'contacted'" class="contacted-text">
            Повідом. {{ formatDate(report.instance?.contactedAt) }}
          </span>
          <div class="card-btn-row">
            <n-button size="small" type="primary" ghost style="flex:1" @click="$emit('submit', report)">
              Здано
            </n-button>
            <n-button size="small" @click="$emit('ignore', report)">
              <template #icon><n-icon><BanOutline /></n-icon></template>
            </n-button>
          </div>
        </template>
      </div>
    </div>
  </n-card>
</template>

<script setup>
import { computed } from 'vue'
import { NCard, NButton, NIcon } from 'naive-ui'
import { RefreshOutline, BanOutline } from '@vicons/ionicons5'
import TaxReportStatusBadge from './TaxReportStatusBadge.vue'

const props = defineProps({
  report: { type: Object, required: true },
})

defineEmits(['submit', 'reset', 'ignore'])

const isOverdue = computed(
  () => props.report.status !== 'submitted' && props.report.status !== 'ignored' && props.report.dueDate < Date.now()
)

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
</script>

<style scoped>
.card--overdue {
  border-color: #d03050 !important;
}

.card--ignored {
  opacity: 0.45;
}

.card-btn-row {
  display: flex;
  gap: 6px;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-name {
  font-weight: 600;
  font-size: 15px;
}

.card-due {
  font-size: 13px;
  opacity: 0.7;
}

.card-due--overdue {
  color: #d03050;
  opacity: 1;
  font-weight: 500;
}

.card-period {
  font-size: 12px;
  opacity: 0.5;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
}

.submitted-text {
  font-size: 13px;
  color: #18a058;
}

.contacted-text {
  font-size: 13px;
  opacity: 0.65;
}
</style>
