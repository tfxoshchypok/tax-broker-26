import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db } from '@/db/index.js'
import { SpecialTaxTypesService } from '@/modules/tax/services/SpecialTaxTypesService.js'

beforeAll(async () => {
  await db.open()
})

afterAll(() => {
  db.close()
})

beforeEach(async () => {
  await db.specialTaxTypes.clear()
  await db.taxProfiles.clear()
  await db.reportRules.clear()
})

// ─── helpers ────────────────────────────────────────────────────────────────

async function addType(key, name = key, active = true) {
  const id = await db.specialTaxTypes.add({ key, name, active })
  return { id, key, name, active }
}

async function addProfile(clientId, specialTaxes = []) {
  return db.taxProfiles.add({ clientId, specialTaxes })
}

async function addRule(ruleId, requiredSpecialTaxes = null) {
  return db.reportRules.add({
    ruleId,
    name: ruleId,
    shortName: ruleId,
    category: 'income',
    frequency: 'annual',
    deadline: { type: 'fixed_date', month: 2, day: 28 },
    condition: { taxSystem: null, simplifiedGroup: null, vatPayer: null, hasEmployees: null, requiredSpecialTaxes },
    active: true,
  })
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

describe('SpecialTaxTypesService CRUD', () => {
  it('getAll returns empty list when table is empty', async () => {
    const result = await SpecialTaxTypesService.getAll()
    expect(result).toEqual([])
  })

  it('add inserts a record and getAll returns it', async () => {
    await SpecialTaxTypesService.add({ key: 'excise_tax', name: 'Акцизний податок', active: true })
    const result = await SpecialTaxTypesService.getAll()
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('excise_tax')
    expect(result[0].name).toBe('Акцизний податок')
    expect(result[0].active).toBe(true)
  })

  it('add returns the new record id', async () => {
    const id = await SpecialTaxTypesService.add({ key: 'land_tax', name: 'Земля', active: true })
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('update changes only specified fields', async () => {
    const { id } = await addType('env_tax', 'Еко')
    await SpecialTaxTypesService.update(id, { name: 'Екологічний податок', active: false })
    const all = await SpecialTaxTypesService.getAll()
    expect(all[0].name).toBe('Екологічний податок')
    expect(all[0].active).toBe(false)
    expect(all[0].key).toBe('env_tax')
  })

  it('remove deletes the record', async () => {
    const { id } = await addType('rent_tax')
    await SpecialTaxTypesService.remove(id)
    const result = await SpecialTaxTypesService.getAll()
    expect(result).toHaveLength(0)
  })

  it('getAll returns records in insertion order', async () => {
    await addType('key_a', 'A')
    await addType('key_b', 'B')
    await addType('key_c', 'C')
    const result = await SpecialTaxTypesService.getAll()
    expect(result.map(r => r.key)).toEqual(['key_a', 'key_b', 'key_c'])
  })
})

// ─── isReferenced ────────────────────────────────────────────────────────────

describe('SpecialTaxTypesService.isReferenced', () => {
  it('returns false when no profiles or rules exist', async () => {
    await addType('excise_tax')
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(false)
  })

  it('returns false when profiles and rules exist but do not reference the key', async () => {
    await addType('excise_tax')
    await addProfile(1, ['land_tax'])
    await addRule('some_rule', ['land_tax'])
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(false)
  })

  it('returns true when a taxProfile includes the key in specialTaxes', async () => {
    await addType('excise_tax')
    await addProfile(1, ['excise_tax'])
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(true)
  })

  it('returns true when a taxProfile has the key among multiple special taxes', async () => {
    await addType('excise_tax')
    await addProfile(1, ['land_tax', 'excise_tax', 'rent_tax'])
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(true)
  })

  it('returns true when a reportRule condition requires the key', async () => {
    await addType('excise_tax')
    await addRule('excise_monthly', ['excise_tax'])
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(true)
  })

  it('returns true when a reportRule condition requires the key among multiple', async () => {
    await addType('excise_tax')
    await addRule('combo_rule', ['land_tax', 'excise_tax'])
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(true)
  })

  it('returns false when rule exists but condition.requiredSpecialTaxes is null', async () => {
    await addType('excise_tax')
    await addRule('generic_rule', null)
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(false)
  })

  it('returns false when rule exists but condition.requiredSpecialTaxes is empty', async () => {
    await addType('excise_tax')
    await addRule('generic_rule', [])
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(false)
  })

  it('returns false after the referencing profile has the key removed', async () => {
    await addType('excise_tax')
    const profileId = await addProfile(1, ['excise_tax'])
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(true)

    await db.taxProfiles.update(profileId, { specialTaxes: [] })
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(false)
  })

  it('returns false after the referencing rule condition is cleared', async () => {
    await addType('excise_tax')
    const ruleDbId = await addRule('excise_monthly', ['excise_tax'])
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(true)

    await db.reportRules.update(ruleDbId, { condition: { requiredSpecialTaxes: null } })
    expect(await SpecialTaxTypesService.isReferenced('excise_tax')).toBe(false)
  })

  it('works correctly for user-defined custom keys', async () => {
    const customKey = 'stt_1717000000000'
    await addType(customKey, 'Туристичний збір')
    expect(await SpecialTaxTypesService.isReferenced(customKey)).toBe(false)

    await addProfile(1, [customKey])
    expect(await SpecialTaxTypesService.isReferenced(customKey)).toBe(true)
  })
})
