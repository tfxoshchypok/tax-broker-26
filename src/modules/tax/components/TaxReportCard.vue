<template>
  <n-card size="small" :class="{ 'card--overdue': isOverdue, 'card--ignored': report.status === 'ignored', 'card--attention': report.rule.requiresAttention }">
    <div class="card-content">
      <div class="card-badges">
        <TaxReportStatusBadge :status="report.status" />
        <n-tag v-if="report.rule.requiresAttention" type="warning" size="small">Увага</n-tag>
      </div>
      <div class="card-name">{{ report.rule.shortName }}</div>

      <div class="card-due" :class="{ 'card-due--overdue': isOverdue }">
        до {{ formatDate(report.dueDate) }}
      </div>
      <div class="card-period">
        {{ report.period }}
        <span v-if="submissionWindow" class="card-window">· здача {{ submissionWindow }}</span>
      </div>

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
import { NCard, NButton, NIcon, NTag } from 'naive-ui'
import { RefreshOutline, BanOutline } from '@vicons/ionicons5'
import TaxReportStatusBadge from './TaxReportStatusBadge.vue'

const props = defineProps({
  report: { type: Object, required: true },
})

defineEmits(['submit', 'reset', 'ignore'])

const isOverdue = computed(
  () => props.report.status !== 'submitted' && props.report.status !== 'ignored' && props.report.dueDate < Date.now()
)

const SHORT_MONTHS = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру']

// Вікно здачі: від місяця початку здачі до місяця крайнього терміну.
const submissionWindow = computed(() => {
  const start = props.report.submissionStart
  const due = props.report.dueDate
  if (!start || !due) return ''
  const s = new Date(start)
  const d = new Date(due)
  const sameMonth = s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth()
  return sameMonth
    ? SHORT_MONTHS[s.getMonth()]
    : `${SHORT_MONTHS[s.getMonth()]}–${SHORT_MONTHS[d.getMonth()]}`
})

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
</script>

<style scoped>
.card--overdue {
  border-color: #d03050 !important;
}

.card--attention {
  border-color: var(--attention-color) !important;
  background: rgba(240, 160, 32, 0.06);
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

.card-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.card-name {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.3;
  word-break: break-word;
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
