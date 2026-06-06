import { describe, it, expect } from 'vitest'
import { buildEnvelope, validateEnvelope, countRecords, APP_ID } from '@/modules/backup/engine/serializer.js'
import { BACKUP_FORMAT_VERSION } from '@/modules/backup/config/backupSchema.js'

describe('buildEnvelope', () => {
  it('wraps data with app id, format version and metadata', () => {
    const env = buildEnvelope({ data: { clients: [{ id: 1 }] }, dbVersion: 12, appVersion: '0.1.8' })
    expect(env.app).toBe(APP_ID)
    expect(env.formatVersion).toBe(BACKUP_FORMAT_VERSION)
    expect(env.dbVersion).toBe(12)
    expect(env.appVersion).toBe('0.1.8')
    expect(env.exportedAt).toBeTypeOf('number')
    expect(env.data.clients).toHaveLength(1)
  })

  it('defaults dbVersion/appVersion to null', () => {
    const env = buildEnvelope({ data: {} })
    expect(env.dbVersion).toBeNull()
    expect(env.appVersion).toBeNull()
  })
})

describe('validateEnvelope', () => {
  const valid = { app: APP_ID, formatVersion: BACKUP_FORMAT_VERSION, data: {} }

  it('accepts a valid envelope', () => {
    expect(validateEnvelope(valid)).toBe(true)
  })

  it('rejects null / non-object', () => {
    expect(() => validateEnvelope(null)).toThrow()
    expect(() => validateEnvelope([])).toThrow()
  })

  it('rejects a foreign file (wrong app id)', () => {
    expect(() => validateEnvelope({ ...valid, app: 'other-app' })).toThrow(/Mini BUH/)
  })

  it('rejects a newer format version', () => {
    expect(() => validateEnvelope({ ...valid, formatVersion: BACKUP_FORMAT_VERSION + 1 })).toThrow(/новішою/)
  })

  it('rejects envelope without data object', () => {
    expect(() => validateEnvelope({ app: APP_ID, formatVersion: BACKUP_FORMAT_VERSION })).toThrow()
    expect(() => validateEnvelope({ app: APP_ID, formatVersion: BACKUP_FORMAT_VERSION, data: [] })).toThrow()
  })
})

describe('countRecords', () => {
  it('sums lengths across tables', () => {
    expect(countRecords({ data: { a: [1, 2], b: [3], c: [] } })).toBe(3)
  })

  it('returns 0 for empty / missing data', () => {
    expect(countRecords({})).toBe(0)
    expect(countRecords({ data: {} })).toBe(0)
  })
})
