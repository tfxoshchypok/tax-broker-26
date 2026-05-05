export const RULES = [

  // ─── Єдиний податок ──────────────────────────────────
  {
    id: 'et_g1_annual',
    name: 'Декларація ЄП (Група 1)',
    shortName: 'ЄП гр.1',
    category: 'unified_tax',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 2, day: 28 },
    condition: p => p.taxSystem === 'simplified' && p.simplifiedGroup === 1,
  },
  {
    id: 'et_g2_annual',
    name: 'Декларація ЄП (Група 2)',
    shortName: 'ЄП гр.2',
    category: 'unified_tax',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 2, day: 28 },
    condition: p => p.taxSystem === 'simplified' && p.simplifiedGroup === 2,
  },
  {
    id: 'et_g3_quarterly',
    name: 'Декларація ЄП (Група 3)',
    shortName: 'ЄП гр.3',
    category: 'unified_tax',
    frequency: 'quarterly',
    deadline: { type: 'days_after_period_end', value: 40 },
    condition: p => p.taxSystem === 'simplified' && [3, '3vat'].includes(p.simplifiedGroup),
  },

  // ─── ПДВ ─────────────────────────────────────────────
  {
    id: 'vat_monthly',
    name: 'Декларація ПДВ',
    shortName: 'ПДВ',
    category: 'vat',
    frequency: 'monthly',
    deadline: { type: 'day_of_next_month', day: 20 },
    condition: p => p.vatPayer,
  },

  // ─── Загальна система ─────────────────────────────────
  {
    id: 'income_annual',
    name: 'Декларація про майновий стан і доходи',
    shortName: 'ПДФО річна',
    category: 'income_tax',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 5, day: 1 },
    condition: p => p.taxSystem === 'general',
  },
  {
    id: 'income_advance_q',
    name: 'Авансовий внесок ПДФО',
    shortName: 'ПДФО аванс',
    category: 'income_tax',
    frequency: 'fixed_dates',
    deadline: {
      type: 'fixed_dates',
      dates: [
        { month: 3, day: 15 },
        { month: 5, day: 15 },
        { month: 8, day: 15 },
        { month: 11, day: 15 },
      ],
    },
    condition: p => p.taxSystem === 'general',
  },

  // ─── Наймана праця ───────────────────────────────────
  {
    id: 'unified_report_q',
    name: "Об'єднана звітність (ЄСВ + 4-ДФ)",
    shortName: 'ЄСВ+4ДФ',
    category: 'employees',
    frequency: 'quarterly',
    deadline: { type: 'days_after_period_end', value: 40 },
    condition: p => p.hasEmployees,
  },

  // ─── Спецподатки ─────────────────────────────────────
  {
    id: 'excise_monthly',
    name: 'Декларація акцизного податку',
    shortName: 'Акциз',
    category: 'excise',
    frequency: 'monthly',
    deadline: { type: 'day_of_next_month', day: 20 },
    condition: p => p.exciseTax,
  },
  {
    id: 'land_annual',
    name: 'Декларація з плати за землю',
    shortName: 'Земля',
    category: 'land',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 2, day: 20 },
    condition: p => p.landTax,
  },
  {
    id: 'env_quarterly',
    name: 'Декларація екологічного податку',
    shortName: 'Еко',
    category: 'environmental',
    frequency: 'quarterly',
    deadline: { type: 'days_after_period_end', value: 40 },
    condition: p => p.environmentalTax,
  },
  {
    id: 'rent_quarterly',
    name: 'Декларація рентної плати',
    shortName: 'Рента',
    category: 'rent',
    frequency: 'quarterly',
    deadline: { type: 'days_after_period_end', value: 40 },
    condition: p => p.rentTax,
  },
]

export const CATEGORY_LABELS = {
  unified_tax: 'ЄП',
  vat: 'ПДВ',
  income_tax: 'ПДФО',
  employees: 'ЄСВ',
  excise: 'Акциз',
  land: 'Земля',
  environmental: 'Еко',
  rent: 'Рента',
}
