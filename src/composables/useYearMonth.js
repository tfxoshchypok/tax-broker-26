import { ref } from 'vue'

export function useYearMonth(onMonthChange) {
  const year  = ref(new Date().getFullYear())
  const month = ref(new Date().getMonth() + 1)

  function prevMonth() {
    if (month.value === 1) { month.value = 12; year.value-- }
    else month.value--
    onMonthChange?.()
  }

  function nextMonth() {
    if (month.value === 12) { month.value = 1; year.value++ }
    else month.value++
    onMonthChange?.()
  }

  return { year, month, prevMonth, nextMonth }
}
