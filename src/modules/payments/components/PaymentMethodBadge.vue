<template>
  <n-tag :type="cfg.type" size="small">
    <template #icon>
      <n-icon><component :is="cfg.icon" /></n-icon>
    </template>
    {{ cfg.label }}
  </n-tag>
</template>

<script setup>
import { computed } from 'vue'
import { NTag, NIcon } from 'naive-ui'
import { CashOutline, CardOutline, CloseCircleOutline } from '@vicons/ionicons5'

const props = defineProps({
  method: { type: String, required: true },
})

const MAP = {
  cash:     { label: 'Готівка',    type: 'default', icon: CashOutline },
  bank:     { label: 'Безготівка', type: 'info',    icon: CardOutline },
  writeoff: { label: 'Списання',   type: 'warning',  icon: CloseCircleOutline },
}

const cfg = computed(() => MAP[props.method] ?? MAP.cash)
</script>
