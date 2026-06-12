<template>
  <n-config-provider :theme="currentTheme" :theme-overrides="themeOverrides" :locale="ukUA" :date-locale="dateUkUA">
    <n-message-provider>
      <n-dialog-provider>
        <AppLayout />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, ukUA, dateUkUA } from 'naive-ui'
import { useUiStore } from '@/stores/ui.js'
import { useBackupStore } from '@/modules/backup/stores/backupStore.js'
import AppLayout from '@/components/AppLayout.vue'

const ui = useUiStore()
const currentTheme = computed(() => ui.theme === 'dark' ? darkTheme : null)

// На світлій темі дефолтні границі Naive UI надто бліді — підсилюємо їх
// глобально (картки, списки, таблиці, інпути). На темній лишаємо як є.
const LIGHT_OVERRIDES = {
  common: {
    borderColor: 'rgba(0, 0, 0, 0.16)',
    dividerColor: 'rgba(0, 0, 0, 0.1)',
  },
}
const themeOverrides = computed(() => ui.theme === 'dark' ? undefined : LIGHT_OVERRIDES)

const backup = useBackupStore()
onMounted(() => backup.maybeAutoBackup())
</script>
