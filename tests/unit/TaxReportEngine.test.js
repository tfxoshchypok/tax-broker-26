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
      vatPayer: null, hasEmployees: null,
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

    describe('requiredSpecialTaxes', () => {
      it('includes rule when requiredSpecialTaxes is null', () => {
        const rule = makeRule('r', 'monthly', { day: 20 }, { requiredSpecialTaxes: null })
        expect(getExpectedReports({ specialTaxes: [] }, 2025, 3, [rule])).toHaveLength(1)
      })

      it('includes rule when requiredSpecialTaxes is empty array', () => {
        const rule = makeRule('r', 'monthly', { day: 20 }, { requiredSpecialTaxes: [] })
        expect(getExpectedReports({ specialTaxes: [] }, 2025, 3, [rule])).toHaveLength(1)
      })

      it('includes rule when profile has the required special tax', () => {
        const rule = makeRule('r', 'monthly', { day: 20 }, { requiredSpecialTaxes: ['excise_tax'] })
        expect(getExpectedReports({ specialTaxes: ['excise_tax'] }, 2025, 3, [rule])).toHaveLength(1)
      })

      it('excludes rule when profile lacks the required special tax', () => {
        const rule = makeRule('r', 'monthly', { day: 20 }, { requiredSpecialTaxes: ['excise_tax'] })
        expect(getExpectedReports({ specialTaxes: [] }, 2025, 3, [rule])).toHaveLength(0)
        expect(getExpectedReports({}, 2025, 3, [rule])).toHaveLength(0)
      })

      it('excludes rule when profile has some but not all required special taxes', () => {
        const rule = makeRule('r', 'monthly', { day: 20 }, { requiredSpecialTaxes: ['excise_tax', 'land_tax'] })
        expect(getExpectedReports({ specialTaxes: ['excise_tax'] }, 2025, 3, [rule])).toHaveLength(0)
      })

      it('includes rule when profile has all required special taxes', () => {
        const rule = makeRule('r', 'monthly', { day: 20 }, { requiredSpecialTaxes: ['excise_tax', 'land_tax'] })
        expect(getExpectedReports({ specialTaxes: ['excise_tax', 'land_tax'] }, 2025, 3, [rule])).toHaveLength(1)
      })

      it('includes rule when profile has more special taxes than required', () => {
        const rule = makeRule('r', 'monthly', { day: 20 }, { requiredSpecialTaxes: ['excise_tax'] })
        expect(getExpectedReports({ specialTaxes: ['excise_tax', 'land_tax', 'rent_tax'] }, 2025, 3, [rule])).toHaveLength(1)
      })

      it('works with user-defined custom special tax keys', () => {
        const rule = makeRule('r', 'monthly', { day: 20 }, { requiredSpecialTaxes: ['stt_1717000000000'] })
        expect(getExpectedReports({ specialTaxes: ['stt_1717000000000'] }, 2025, 3, [rule])).toHaveLength(1)
        expect(getExpectedReports({ specialTaxes: [] }, 2025, 3, [rule])).toHaveLength(0)
      })
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

    it('appears from January (submission opens) through the deadline month', () => {
      expect(getExpectedReports(anyProfile, 2025, 1, [rule])).toHaveLength(1)
      expect(getExpectedReports(anyProfile, 2025, 2, [rule])).toHaveLength(1)
      expect(getExpectedReports(anyProfile, 2025, 3, [rule])).toHaveLength(0)
    })

    it('spans every month from January to a later deadline (e.g. May 1)', () => {
      const lateRule = makeRule('inc', 'annual', { month: 5, day: 1 })
      for (const m of [1, 2, 3, 4, 5]) {
        expect(getExpectedReports(anyProfile, 2025, m, [lateRule])).toHaveLength(1)
      }
      expect(getExpectedReports(anyProfile, 2025, 6, [lateRule])).toHaveLength(0)
      expect(getExpectedReports(anyProfile, 2025, 12, [lateRule])).toHaveLength(0)
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

  describe('submissionStart (вікно здачі)', () => {
    it('monthly: 1st day of the deadline month', () => {
      const [r] = getExpectedReports(anyProfile, 2025, 3, [makeRule('vat', 'monthly', { day: 20 })])
      expect(r.submissionStart).toBe(new Date(2025, 2, 1).getTime())
    })

    it('annual: January 1st of the viewed year', () => {
      const [r] = getExpectedReports(anyProfile, 2025, 2, [makeRule('ann', 'annual', { month: 2, day: 28 })])
      expect(r.submissionStart).toBe(new Date(2025, 0, 1).getTime())
    })

    it('quarterly: the day after the quarter ends', () => {
      const result = getExpectedReports(anyProfile, 2025, 5, [makeRule('q', 'quarterly', { value: 40 })])
      const q1 = result.find(r => r.period === '2025-Q1')
      expect(q1.submissionStart).toBe(new Date(2025, 3, 1).getTime()) // 1 квітня
    })

    it('fixed_dates: 1st day of the payment month', () => {
      const rule = makeRule('adv', 'fixed_dates', { dates: [{ month: 3, day: 15 }] })
      const [r] = getExpectedReports(anyProfile, 2025, 3, [rule])
      expect(r.submissionStart).toBe(new Date(2025, 2, 1).getTime())
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
