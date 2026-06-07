// Сутності-джерела документів, похідні від схеми даних (dataSchema.js).
// Блок тегів кожної сутності генерується автоматично: базова таблиця + всі
// таблиці, на які вона посилається (FK).

import { TABLES, DOCUMENT_BASES, buildTokenGroups, buildSampleContext } from './dataSchema.js'

export const ENTITIES = DOCUMENT_BASES.map(key => ({
  key,
  label: TABLES[key].label,
  hasLines: !!TABLES[key].hasLines,
  tokenGroups: buildTokenGroups(key),
  defaultBody: TABLES[key].defaultBody ?? '',
  buildContext: (overrides) => buildSampleContext(key, overrides),
}))

export const ENTITY_OPTIONS = ENTITIES.map(e => ({ label: e.label, value: e.key }))

export function getEntity(key) {
  return ENTITIES.find(e => e.key === key) ?? ENTITIES[0]
}

export function entityLabel(key) {
  return getEntity(key).label
}
