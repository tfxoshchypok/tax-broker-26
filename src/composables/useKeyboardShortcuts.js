import { onMounted, onUnmounted } from 'vue'

export function useKeyboardShortcuts(shortcuts) {
  function onKeydown(e) {
    for (const [combo, fn] of Object.entries(shortcuts)) {
      const parts = combo.toLowerCase().split('+')
      const key = parts.at(-1)
      const needsCtrl = parts.includes('ctrl')
      const needsShift = parts.includes('shift')

      // Ctrl matches both Ctrl (Win/Linux) and Meta (Mac)
      const ctrlMatch = needsCtrl
        ? (e.ctrlKey || e.metaKey)
        : (!e.ctrlKey && !e.metaKey)

      if (e.key.toLowerCase() === key && ctrlMatch && e.shiftKey === needsShift) {
        e.preventDefault()
        fn(e)
        return
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
