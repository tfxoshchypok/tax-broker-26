<template>
  <n-layout has-sider style="height: 100vh;">
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="56"
      :width="220"
      :collapsed="ui.sidebarCollapsed"
      show-trigger
      @collapse="ui.sidebarCollapsed = true"
      @expand="ui.sidebarCollapsed = false"
    >
      <div class="sidebar-logo">
        <n-icon size="24"><PersonCircleOutline /></n-icon>
        <span v-if="!ui.sidebarCollapsed" class="logo-text">Tax-Broker-26</span>
      </div>

      <n-menu
        :collapsed="ui.sidebarCollapsed"
        :collapsed-width="56"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
      />

      <div class="sidebar-footer">
        <n-tooltip placement="right" :disabled="!ui.sidebarCollapsed">
          <template #trigger>
            <n-button text @click="ui.toggleTheme()" style="width: 100%; justify-content: flex-start; padding: 8px 12px;">
              <template #icon>
                <n-icon><SunnyOutline v-if="ui.theme === 'dark'" /><MoonOutline v-else /></n-icon>
              </template>
              <span v-if="!ui.sidebarCollapsed">{{ ui.theme === 'dark' ? 'Світла' : 'Темна' }}</span>
            </n-button>
          </template>
          {{ ui.theme === 'dark' ? 'Світла тема' : 'Темна тема' }}
        </n-tooltip>
      </div>
    </n-layout-sider>

    <n-layout>
      <n-layout-content content-style="height: 100vh; overflow-y: auto;">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup>
import { computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NLayout, NLayoutSider, NLayoutContent, NMenu, NIcon, NButton, NTooltip } from 'naive-ui'
import { PersonCircleOutline, PeopleOutline, PricetagsOutline, SettingsOutline, SunnyOutline, MoonOutline, DocumentTextOutline, ReceiptOutline, WalletOutline, LayersOutline } from '@vicons/ionicons5'
import { useUiStore } from '@/stores/ui.js'

const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const activeKey = computed(() => route.name)

function renderIcon(icon) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions = [
  {
    label: 'Клієнти',
    key: 'clients',
    icon: renderIcon(PeopleOutline),
    onClick: () => router.push({ name: 'clients' }),
  },
  {
    label: 'Теги',
    key: 'tags',
    icon: renderIcon(PricetagsOutline),
    onClick: () => router.push({ name: 'tags' }),
  },
  {
    label: 'Групи',
    key: 'groups',
    icon: renderIcon(LayersOutline),
    onClick: () => router.push({ name: 'groups' }),
  },
  {
    label: 'Звіти',
    key: 'tax-dashboard',
    icon: renderIcon(DocumentTextOutline),
    onClick: () => router.push({ name: 'tax-dashboard' }),
  },
  {
    label: 'Рахунки',
    key: 'billing-dashboard',
    icon: renderIcon(ReceiptOutline),
    onClick: () => router.push({ name: 'billing-dashboard' }),
  },
  {
    label: 'Платежі',
    key: 'payments-dashboard',
    icon: renderIcon(WalletOutline),
    onClick: () => router.push({ name: 'payments-dashboard' }),
  },
  {
    label: 'Налаштування',
    key: 'settings',
    icon: renderIcon(SettingsOutline),
    onClick: () => router.push({ name: 'settings' }),
  },
]
</script>

<style scoped>
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 14px;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
}

.logo-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  padding: 0 4px;
}
</style>
