<template>
  <n-tag :type="cfg.type" size="small" round>
    <template #icon><n-icon><component :is="cfg.icon" /></n-icon></template>
    {{ cfg.label }}
  </n-tag>
</template>

<script setup>
import { computed } from 'vue'
import { NTag, NIcon } from 'naive-ui'
import { TimeOutline, ChatbubbleOutline, CheckmarkCircleOutline, BanOutline } from '@vicons/ionicons5'

const props = defineProps({
  status: { type: String, required: true },
})

const STATUS_CONFIG = {
  pending:   { type: 'default',  icon: TimeOutline,              label: 'Очікується' },
  contacted: { type: 'warning',  icon: ChatbubbleOutline,        label: 'Повідомлено' },
  submitted: { type: 'success',  icon: CheckmarkCircleOutline,   label: 'Здано' },
  ignored:   { type: 'default',  icon: BanOutline,               label: 'Ігнор' },
}

const cfg = computed(() => STATUS_CONFIG[props.status] ?? STATUS_CONFIG.pending)
</script>
