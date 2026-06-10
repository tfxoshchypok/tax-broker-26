// Report categories — shared by the dashboard filter and individual report types
// so manually-scheduled reports fold into the same category filters.
export const REPORT_CATEGORIES = [
  { value: 'income',     label: 'Прибуток' },
  { value: 'vat_excise', label: 'ПДВ+акциз' },
  { value: 'local',      label: 'Місцеві' },
  { value: 'resource',   label: 'Ресурсні' },
  { value: 'rent',       label: 'Рентні' },
  { value: 'financial',  label: 'Фінзвітність' },
  { value: 'esv',        label: 'ЄСВ' },
  { value: 'other',      label: 'Інші' },
]

export const REPORT_CATEGORY_OPTIONS = REPORT_CATEGORIES.map(c => ({ label: c.label, value: c.value }))

const CATEGORY_LABEL = Object.fromEntries(REPORT_CATEGORIES.map(c => [c.value, c.label]))

export function reportCategoryLabel(value) {
  return CATEGORY_LABEL[value] ?? value
}
