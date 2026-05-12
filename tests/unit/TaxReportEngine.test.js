import { describe, it, expect } from 'vitest'
import { getExpectedReports } from '@/modules/tax/services/TaxReportEngine.js'

// Engine-compatible rule format: id === ruleId (as returned by activeForEngine in the store)
function makeRule(ruleId, frequency, deadline, conditionOverrides = {}) {
  return {
    id: ruleId,
    ruleId,
    frequency,
    deadline,
    condition: {
      clientType: null, taxSystem: null, simplifiedGroup: null,
      vatPayer: null, hasEmployees: null, exciseTax: null,
      landTax: null, environmentalTax: null, rentTax: null,
      ...conditionOverrides,
    },
  }
}

const anyProfile = {}

describe('getExpectedReports', () => {
  describe('evaluateCondition', () => {
    it('includes rule when all condition fields are null', () => {
      const result = getExpectedReports(anyProfile, 2025, 3, [makeRule('r', 'monthly', { day: 20 })])
      expect(result).toHaveLength(1)
    })

    it('excludes rule when clientType does not match', () => {
      const rule = makeRule('r', 'monthly', { day: 20 }, { clientType: 'legal' })
      expect(getExpectedReports({ clientType: 'fop' }, 2025, 3, [rule])).toHaveLength(0)
    })

    it('excludes rule when taxSystem does not match', () => {
      const rule = makeRule('r', 'monthly', { day: 20 }, { taxSystem: 'simplified' })
      expect(getExpectedReports({ taxSystem: 'general' }, 2025, 3, [rule])).toHaveLength(0)
    })

    it('includes rule when simplifiedGroup is in the allowed list (number and string variants)', () => {
      const rule = makeRule('r', 'monthly', { day: 20 }, { simplifiedGroup: [3, '3vat'] })
      expect(getExpectedReports({ simplifiedGroup: 3 }, 2025, 3, [rule])).toHaveLength(1)
      expect(getExpectedReports({ simplifiedGroup: '3vat' }, 2025, 3, [rule])).toHaveLength(1)
      expect(getExpectedReports({ simplifiedGroup: 1 }, 2025, 3, [rule])).toHaveLength(0)
    })

    it('excludes rule when vatPayer condition is true but profile.vatPayer is falsy', () => {
      const rule = makeRule('r', 'monthly', { day: 20 }, { vatPayer: true })
      expect(getExpectedReports({ vatPayer: false }, 2025, 3, [rule])).toHaveLength(0)
      expect(getExpectedReports({ vatPayer: true }, 2025, 3, [rule])).toHaveLength(1)
    })
  })

  describe('monthly frequency', () => {
    const rule = makeRule('vat', 'monthly', { day: 20 })

    it('sets period to previous month and dueDate within the current month', () => {
      const [report] = getExpectedReports(anyProfile, 2025, 3, [rule])
      expect(report.period).toBe('2025-02')
      expect(report.dueDate).toBe(new Date(2025, 2, 20).getTime())
    })

    it('wraps January back to December of the previous year', () => {
      const [report] = getExpectedReports(anyProfile, 2025, 1, [rule])
      expect(report.period).toBe('2024-12')
      expect(report.dueDate).toBe(new Date(2025, 0, 20).getTime())
    })
  })

  describe('quarterly frequency', () => {
    const rule = makeRule('q', 'quarterly', { value: 40 })

    it('shows Q1 in May (40 days after March 31)', () => {
      const result = getExpectedReports(anyProfile, 2025, 5, [rule])
      expect(result.some(r => r.period === '2025-Q1')).toBe(true)
    })

    it('shows Q4 of previous year in February', () => {
      const result = getExpectedReports(anyProfile, 2025, 2, [rule])
      expect(result.some(r => r.period === '2024-Q4')).toBe(true)
    })

    it('does not produce duplicate periods for the same rule', () => {
      const result = getExpectedReports(anyProfile, 2025, 5, [rule])
      const periods = result.map(r => r.period)
      expect(periods.length).toBe(new Set(periods).size)
    })
  })

  describe('annual frequency', () => {
    const rule = makeRule('ann', 'annual', { month: 2, day: 28 })

    it('appears in the month before the deadline and in the deadline month', () => {
      expect(getExpectedReports(anyProfile, 2025, 1, [rule])).toHaveLength(1)
      expect(getExpectedReports(anyProfile, 2025, 2, [rule])).toHaveLength(1)
      expect(getExpectedReports(anyProfile, 2025, 3, [rule])).toHaveLength(0)
    })

    it('sets period to the year before the deadline', () => {
      const [report] = getExpectedReports(anyProfile, 2025, 2, [rule])
      expect(report.period).toBe('2024')
    })
  })

  describe('fixed_dates frequency', () => {
    const advanceDates = [
      { month: 3, day: 15 },
      { month: 5, day: 15 },
      { month: 8, day: 15 },
      { month: 11, day: 15 },
    ]
    const rule = makeRule('adv', 'fixed_dates', { dates: advanceDates })

    it('matches March and sets period to Q1', () => {
      const [report] = getExpectedReports(anyProfile, 2025, 3, [rule])
      expect(report.period).toBe('2025-Q1')
      expect(report.dueDate).toBe(new Date(2025, 2, 15).getTime())
    })

    it('returns nothing in non-payment months', () => {
      expect(getExpectedReports(anyProfile, 2025, 4, [rule])).toHaveLength(0)
      expect(getExpectedReports(anyProfile, 2025, 6, [rule])).toHaveLength(0)
    })
  })

  it('returns results sorted by dueDate ascending', () => {
    const rules = [
      makeRule('ann', 'annual', { month: 5, day: 1 }),
      makeRule('vat', 'monthly', { day: 20 }),
    ]
    const result = getExpectedReports(anyProfile, 2025, 5, rules)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].dueDate).toBeGreaterThanOrEqual(result[i - 1].dueDate)
    }
  })

  it('returns empty array when rules list is empty', () => {
    expect(getExpectedReports(anyProfile, 2025, 3, [])).toEqual([])
  })
})
