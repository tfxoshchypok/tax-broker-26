import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/db/index.js'
import { validateDataSchema } from '@/modules/documents/config/schemaValidator.js'
import { TABLES, buildTokenGroups, buildSampleContext } from '@/modules/documents/config/dataSchema.js'
import { ENTITIES } from '@/modules/documents/config/entities.js'

beforeAll(async () => { await db.open() })
afterAll(() => { db.close() })

describe('validateDataSchema', () => {
  it('метадані dataSchema узгоджені зі схемою БД (без помилок)', () => {
    const { errors } = validateDataSchema(db)
    expect(errors).toEqual([])
  })

  it('усі таблиці dataSchema існують у db.tables', () => {
    const dbNames = db.tables.map(t => t.name)
    for (const name of Object.keys(TABLES)) {
      expect(dbNames).toContain(name)
    }
  })

  it('усі цілі звʼязків існують у dataSchema', () => {
    for (const [, meta] of Object.entries(TABLES)) {
      for (const rel of meta.relations ?? []) {
        expect(TABLES[rel.target]).toBeDefined()
      }
    }
  })

  it('ключ сутності = імʼя таблиці (узгодженість type ↔ buildContext)', () => {
    const dbNames = db.tables.map(t => t.name)
    for (const e of ENTITIES) {
      expect(dbNames).toContain(e.key)   // type шаблону = реальна таблиця
      expect(TABLES[e.key]).toBeDefined()
    }
  })
})

describe('buildTokenGroups', () => {
  it('для рахунка містить базову таблицю + звʼязані (клієнт, виконавець)', () => {
    const labels = buildTokenGroups('invoices').map(g => g.label)
    expect(labels).toContain('Рахунок')
    expect(labels).toContain('Клієнт')
    expect(labels).toContain('Виконавець')
  })

  it('базова таблиця з hasLines отримує токен таблиці позицій', () => {
    const base = buildTokenGroups('invoices')[0]
    expect(base.tokens.some(t => /table\.lines/.test(t.token))).toBe(true)
  })

  it('токени мають префікс ns своєї таблиці', () => {
    const clientGroup = buildTokenGroups('clients')[0]
    expect(clientGroup.tokens.every(t => t.token.includes('client.'))).toBe(true)
  })
})

describe('buildSampleContext', () => {
  it('йде по звʼязках і заповнює базову та звʼязані сутності', () => {
    const ctx = buildSampleContext('invoices')
    expect(ctx.invoice).toBeDefined()
    expect(ctx.client?.name).toBeTruthy()
    expect(ctx.owner?.fullName).toBeTruthy()
    expect(Array.isArray(ctx.lines)).toBe(true)
  })

  it('overrides заміщують sample звʼязаної таблиці', () => {
    const ctx = buildSampleContext('invoices', { ownerProfile: { fullName: 'ТОВ Тест' } })
    expect(ctx.owner.fullName).toBe('ТОВ Тест')
  })
})
