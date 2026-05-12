import { describe, it, expect } from 'vitest'
import { InvoiceGenerator } from '@/modules/billing/services/InvoiceGenerator.js'

// ratesMap is keyed by r.ruleId and looked up by rule.id (== ruleId in engine-compatible format)
const makeRate = (ruleId, overrides = {}) => ({
  ruleId,
  active: true,
  autoInclude: true,
  name: `Послуга ${ruleId}`,
  price: 500,
  ...overrides,
})

const makeReport = (ruleId, period = '2025-02') => ({
  rule: { id: ruleId },
  period,
  dueDate: Date.now(),
})

describe('InvoiceGenerator.generateDraftLines', () => {
  it('creates a line for a report matched by an active autoInclude rate', () => {
    const lines = InvoiceGenerator.generateDraftLines(
      [makeReport('vat_monthly')],
      [makeRate('vat_monthly')],
      [],
    )
    expect(lines).toHaveLength(1)
    expect(lines[0].ruleId).toBe('vat_monthly')
    expect(lines[0].unitPrice).toBe(500)
    expect(lines[0].type).toBe('auto')
  })

  it('skips reports with no matching rate', () => {
    const lines = InvoiceGenerator.generateDraftLines(
      [makeReport('vat_monthly')],
      [makeRate('other_rule')],
      [],
    )
    expect(lines).toHaveLength(0)
  })

  it('skips inactive rates', () => {
    const lines = InvoiceGenerator.generateDraftLines(
      [makeReport('vat_monthly')],
      [makeRate('vat_monthly', { active: false })],
      [],
    )
    expect(lines).toHaveLength(0)
  })

  it('skips rates where autoInclude is false', () => {
    const lines = InvoiceGenerator.generateDraftLines(
      [makeReport('vat_monthly')],
      [makeRate('vat_monthly', { autoInclude: false })],
      [],
    )
    expect(lines).toHaveLength(0)
  })

  it('populates instanceId when a matching instance exists for the same ruleId and period', () => {
    const instance = { id: 42, ruleId: 'vat_monthly', period: '2025-02' }
    const lines = InvoiceGenerator.generateDraftLines(
      [makeReport('vat_monthly', '2025-02')],
      [makeRate('vat_monthly')],
      [instance],
    )
    expect(lines[0].instanceId).toBe(42)
  })

  it('sets instanceId to null when instance period does not match', () => {
    const instance = { id: 99, ruleId: 'vat_monthly', period: '2025-01' }
    const lines = InvoiceGenerator.generateDraftLines(
      [makeReport('vat_monthly', '2025-02')],
      [makeRate('vat_monthly')],
      [instance],
    )
    expect(lines[0].instanceId).toBeNull()
  })

  it('sets sortOrder based on the report index in the input array', () => {
    const lines = InvoiceGenerator.generateDraftLines(
      [makeReport('r1'), makeReport('r2'), makeReport('r3')],
      [makeRate('r1'), makeRate('r2'), makeRate('r3')],
      [],
    )
    expect(lines.map(l => l.sortOrder)).toEqual([0, 1, 2])
  })
})
