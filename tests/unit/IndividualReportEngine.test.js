import { describe, it, expect } from 'vitest'
import { getIndividualReports } from '@/modules/tax/services/IndividualReportEngine.js'

const oneOff = {
  id: 1, key: 'ind_1', name: 'Разовий звіт', shortName: 'Разовий',
  category: 'other', mode: 'one_off', intervalMonths: null, active: true,
}
const quarterly = {
  id: 2, key: 'ind_2', name: 'Акцизний внесок', shortName: 'Акциз внесок',
  category: 'vat_excise', mode: 'periodic', intervalMonths: 3, active: true,
}
const monthly = {
  id: 3, key: 'ind_3', name: 'Щомісячний', shortName: 'Міс',
  category: 'other', mode: 'periodic', intervalMonths: 1, active: true,
}

const typesById = { 1: oneOff, 2: quarterly, 3: monthly }

const ts = (y, m, d) => new Date(y, m - 1, d).getTime()
const assign = (typeId, dueDate, leadDays = 0) => ({ id: 100 + typeId, typeId, dueDate, leadDays })

describe('getIndividualReports', () => {
  describe('one-off', () => {
    it('appears in the deadline month', () => {
      const res = getIndividualReports([assign(1, ts(2025, 3, 15))], typesById, 2025, 3)
      expect(res).toHaveLength(1)
      expect(res[0].period).toBe('2025-03')
      expect(res[0].dueDate).toBe(ts(2025, 3, 15))
      expect(res[0].rule.ruleId).toBe('ind_1')
      expect(res[0].rule.shortName).toBe('Разовий')
    })

    it('with no lead window, submissionStart equals dueDate', () => {
      const res = getIndividualReports([assign(1, ts(2025, 3, 15), 0)], typesById, 2025, 3)
      expect(res[0].submissionStart).toBe(res[0].dueDate)
    })

    it('does not appear in other months', () => {
      expect(getIndividualReports([assign(1, ts(2025, 3, 15))], typesById, 2025, 4)).toHaveLength(0)
      expect(getIndividualReports([assign(1, ts(2025, 3, 15))], typesById, 2025, 2)).toHaveLength(0)
    })

    it('appears earlier when the lead window reaches into a previous month', () => {
      const a = assign(1, ts(2025, 3, 10), 20) // window starts ~Feb 18
      expect(getIndividualReports([a], typesById, 2025, 2)).toHaveLength(1)
      expect(getIndividualReports([a], typesById, 2025, 3)).toHaveLength(1)
      expect(getIndividualReports([a], typesById, 2025, 1)).toHaveLength(0)
    })
  })

  describe('periodic (quarterly)', () => {
    const a = assign(2, ts(2025, 3, 15)) // anchor 15 Mar 2025, every 3 months

    it('shows the occurrence in each interval month', () => {
      expect(getIndividualReports([a], typesById, 2025, 3)).toHaveLength(1)
      expect(getIndividualReports([a], typesById, 2025, 6)).toHaveLength(1)
      expect(getIndividualReports([a], typesById, 2025, 9)).toHaveLength(1)
      expect(getIndividualReports([a], typesById, 2025, 12)).toHaveLength(1)
      expect(getIndividualReports([a], typesById, 2026, 3)).toHaveLength(1)
    })

    it('uses the occurrence date, not the anchor', () => {
      const res = getIndividualReports([a], typesById, 2025, 6)
      expect(res[0].period).toBe('2025-06')
      expect(res[0].dueDate).toBe(ts(2025, 6, 15))
    })

    it('does not show in non-interval months', () => {
      expect(getIndividualReports([a], typesById, 2025, 4)).toHaveLength(0)
      expect(getIndividualReports([a], typesById, 2025, 7)).toHaveLength(0)
    })

    it('does not show before the anchor', () => {
      expect(getIndividualReports([a], typesById, 2025, 1)).toHaveLength(0)
      expect(getIndividualReports([a], typesById, 2024, 12)).toHaveLength(0)
    })
  })

  describe('periodic day-overflow', () => {
    it('clamps to the last day of a shorter month', () => {
      const a = assign(3, ts(2025, 1, 31)) // monthly from Jan 31
      const res = getIndividualReports([a], typesById, 2025, 2)
      expect(res).toHaveLength(1)
      expect(res[0].dueDate).toBe(ts(2025, 2, 28))
    })
  })

  describe('guards', () => {
    it('skips inactive types', () => {
      const types = { 1: { ...oneOff, active: false } }
      expect(getIndividualReports([assign(1, ts(2025, 3, 15))], types, 2025, 3)).toHaveLength(0)
    })

    it('skips assignments whose type is missing', () => {
      expect(getIndividualReports([assign(99, ts(2025, 3, 15))], typesById, 2025, 3)).toHaveLength(0)
    })

    it('sorts results by dueDate', () => {
      const res = getIndividualReports(
        [assign(1, ts(2025, 3, 25)), assign(2, ts(2025, 3, 5))],
        typesById, 2025, 3,
      )
      expect(res.map(r => r.dueDate)).toEqual([ts(2025, 3, 5), ts(2025, 3, 25)])
    })
  })
})
