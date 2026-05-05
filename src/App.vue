<template>
  <n-config-provider :theme="currentTheme" :locale="ukUA" :date-locale="dateUkUA">
    <n-message-provider>
      <n-dialog-provider>
        <AppLayout />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, ukUA, dateUkUA } from 'naive-ui'
import { useUiStore } from '@/stores/ui.js'
import AppLayout from '@/components/AppLayout.vue'

const ui = useUiStore()
const currentTheme = computed(() => ui.theme === 'dark' ? darkTheme : null)
</script>
