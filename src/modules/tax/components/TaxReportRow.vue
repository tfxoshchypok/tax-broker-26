<template>
  <div class="report-row" :class="{ 'report-row--overdue': isOverdue }">
    <TaxReportStatusBadge :status="report.status" />

    <span class="report-name">{{ report.rule.shortName }}</span>
    <span class="report-period">{{ report.period }}</span>

    <span class="report-due" :class="{ 'report-due--overdue': isOverdue }">
      до {{ formatDate(report.dueDate) }}
    </span>

    <div class="report-actions">
      <template v-if="report.status === 'submitted'">
        <span class="action-text action-text--green">
          Здано {{ formatDate(report.instance?.submittedAt) }}
        </span>
        <n-button text size="tiny" @click="$emit('reset', report)">
          <template #icon><n-icon><RefreshOutline /></n-icon></template>
        </n-button>
      </template>
      <template v-else>
        <span v-if="report.status === 'contacted'" class="action-text">
          Повідом. {{ formatDate(report.instance?.contactedAt) }}
        </span>
        <n-button size="small" type="primary" ghost @click="$emit('submit', report)">Здано</n-button>
      </template>

      <n-popover trigger="click" placement="bottom-end" :width="220">
        <template #trigger>
          <n-button text size="small" :type="report.instance?.notes ? 'warning' : 'default'">
            <template #icon><n-icon><CreateOutline /></n-icon></template>
          </n-button>
        </template>
        <n-input
          :value="report.instance?.notes ?? ''"
          type="textarea"
          :rows="3"
          placeholder="Нотатка..."
          @blur="onNotesBlur($event, report)"
        />
      </n-popover>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NButton, NIcon, NPopover, NInput } from 'naive-ui'
import { RefreshOutline, CreateOutline } from '@vicons/ionicons5'
import TaxReportStatusBadge from './TaxReportStatusBadge.vue'

const props = defineProps({
  report: { type: Object, required: true },
})

const emit = defineEmits(['submit', 'reset', 'notes'])

const isOverdue = computed(
  () => props.report.status !== 'submitted' && props.report.dueDate < Date.now()
)

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function onNotesBlur(event, report) {
  emit('notes', { report, notes: event.target.value })
}
</script>

<style scoped>
.report-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.15s;
}

.report-row:hover {
  background: rgba(128, 128, 128, 0.06);
}

.report-row--overdue {
  background: rgba(208, 48, 80, 0.05);
}

.report-name {
  font-weight: 500;
  min-width: 80px;
}

.report-period {
  font-size: 12px;
  opacity: 0.55;
  min-width: 70px;
}

.report-due {
  font-size: 13px;
  opacity: 0.7;
  flex: 1;
}

.report-due--overdue {
  color: #d03050;
  opacity: 1;
  font-weight: 500;
}

.report-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.action-text {
  font-size: 13px;
  opacity: 0.65;
}

.action-text--green {
  color: #18a058;
  opacity: 1;
}
</style>
