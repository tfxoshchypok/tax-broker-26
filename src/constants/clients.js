export const STATUS_MAP = {
  lead:     { label: 'Лід',      type: 'warning' },
  active:   { label: 'Активний', type: 'success' },
  inactive: { label: 'Архів',    type: 'default' },
}

export const statusLabel = s => STATUS_MAP[s]?.label ?? s
export const statusType  = s => STATUS_MAP[s]?.type  ?? 'default'

export const CLIENT_TYPE_LABEL = { individual: 'Фіз.',           fop: 'ФОП', legal: 'Юр.' }
export const CLIENT_TYPE_MAP   = { individual: 'Фізична особа',  fop: 'ФОП', legal: 'Юридична особа' }
