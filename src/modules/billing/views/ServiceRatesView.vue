<template>
  <div class="view-container">
    <n-page-header title="Прайс-лист послуг" @back="$router.back()" />
    <div style="margin-top: 16px;">
      <ServiceRatesPanel />
    </div>
  </div>
</template>

<script setup>
import { NPageHeader } from 'naive-ui'
import ServiceRatesPanel from '../components/ServiceRatesPanel.vue'
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 800px;
}
</style>
