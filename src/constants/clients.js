export const STATUS_MAP = {
  lead:     { label: 'Лід',      type: 'warning' },
  active:   { label: 'Активний', type: 'success' },
  inactive: { label: 'Архів',    type: 'default' },
}

export const statusLabel = s => STATUS_MAP[s]?.label ?? s
export const statusType  = s => STATUS_MAP[s]?.type  ?? 'default'

export const CLIENT_TYPE_LABEL = { individual: 'Фіз.',           fop: 'ФОП', legal: 'Юр.' }
export const CLIENT_TYPE_MAP   = { individual: 'Фізична особа',  fop: 'ФОП', legal: 'Юридична особа' }

// Єдине поле ідентифікаційного коду клієнта (ключ зберігання — завжди `ipn`),
// але підпис/підказка залежать від типу: юрособа має ЄДРПОУ (8 цифр),
// фізособа/ФОП — ІПН/РНОКПП (10 цифр).
export const ipnLabel       = t => (t === 'legal' ? 'ЄДРПОУ' : 'ІПН / РНОКПП')
export const ipnPlaceholder = t => (t === 'legal' ? '12345678' : '1234567890')
