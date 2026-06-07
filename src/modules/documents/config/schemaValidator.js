// Dev-валідатор: звіряє метадані dataSchema.js з реальною схемою Dexie (db.tables).
// Захищає від дрейфу, коли БД змінилась, а метадані — ні.
//   errors — критичні розбіжності (таблиці/звʼязки не існують, дублікати ns).
//   hints  — підказки (можливий незадекларований FK, неіндексований FK).

import { TABLES } from './dataSchema.js'

function indexedKeyPaths(table) {
  const set = new Set()
  const pk = table.schema.primKey?.keyPath
  if (typeof pk === 'string') set.add(pk)
  for (const idx of table.schema.indexes ?? []) {
    if (typeof idx.keyPath === 'string') set.add(idx.keyPath)
  }
  return set
}

export function validateDataSchema(db) {
  const errors = []
  const hints = []

  const dbNames = new Set(db.tables.map(t => t.name))
  const indexes = {}
  for (const t of db.tables) indexes[t.name] = indexedKeyPaths(t)

  const nsSeen = new Map()

  for (const [name, meta] of Object.entries(TABLES)) {
    if (!dbNames.has(name)) {
      errors.push(`Таблиця «${name}» є в dataSchema, але відсутня в БД (db.tables)`)
    }
    if (!meta.fields?.length) {
      errors.push(`«${name}»: не визначено полів (fields)`)
    }
    if (meta.ns) {
      if (nsSeen.has(meta.ns)) errors.push(`ns «${meta.ns}» дублюється: «${nsSeen.get(meta.ns)}» і «${name}»`)
      else nsSeen.set(meta.ns, name)
    }

    for (const rel of meta.relations ?? []) {
      if (!TABLES[rel.target]) {
        errors.push(`Звʼязок «${name}» → «${rel.target}»: цільової таблиці немає в dataSchema`)
      } else if (!dbNames.has(rel.target)) {
        errors.push(`Звʼязок «${name}» → «${rel.target}»: цільової таблиці немає в БД`)
      }
      if (rel.field && !indexes[name]?.has(rel.field)) {
        hints.push(`«${name}.${rel.field}»: FK не індексований у БД (для друку по звʼязку бажано індекс)`)
      }
    }

    // Підказка: індексовані поля на *Id, не оголошені як relation
    const mapped = new Set((meta.relations ?? []).map(r => r.field).filter(Boolean))
    for (const kp of indexes[name] ?? []) {
      if (kp !== 'id' && /Id$/.test(kp) && !mapped.has(kp)) {
        hints.push(`«${name}.${kp}» схоже на FK, але не оголошене як relation`)
      }
    }
  }

  return { errors, hints }
}
