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
import { DocumentOutline, CheckmarkOutline, CheckmarkCircleOutline, CloseCircleOutline } from '@vicons/ionicons5'

const props = defineProps({
  status: { type: String, required: true },
})

const MAP = {
  draft:     { label: 'Чернетка',    type: 'default', icon: DocumentOutline },
  confirmed: { label: 'Підтверджено', type: 'info',    icon: CheckmarkOutline },
  paid:      { label: 'Оплачено',    type: 'success',  icon: CheckmarkCircleOutline },
  cancelled: { label: 'Скасовано',   type: 'error',    icon: CloseCircleOutline },
}

const cfg = computed(() => MAP[props.status] ?? MAP.draft)
</script>
