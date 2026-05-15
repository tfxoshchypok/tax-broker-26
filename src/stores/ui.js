import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const theme = ref(localStorage.getItem('mb_theme') ?? 'light')
  const defaultPageSize = ref(Number(localStorage.getItem('mb_pageSize')) || 20)
  const showOwnerOnCash = ref(localStorage.getItem('mb_showOwnerOnCash') === 'true')

  watch(theme, v => localStorage.setItem('mb_theme', v))
  watch(defaultPageSize, v => localStorage.setItem('mb_pageSize', String(v)))
  watch(showOwnerOnCash, v => localStorage.setItem('mb_showOwnerOnCash', String(v)))

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  return { sidebarCollapsed, theme, defaultPageSize, showOwnerOnCash, toggleSidebar, toggleTheme }
})
