import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db } from '@/db/index.js'
import { TaxReportService } from '@/modules/tax/services/TaxReportService.js'

const CLIENT_ID = 1
const RULE_ID = 'vat_monthly'
const PERIOD = '2025-02'
const DUE_DATE = new Date(2025, 1, 20).getTime()

beforeAll(async () => {
  await db.open()
})

afterAll(() => {
  db.close()
})

beforeEach(async () => {
  await db.taxReportInstances.clear()
  await db.taxProfiles.clear()
})

describe('TaxReportService', () => {
  describe('markContacted', () => {
    it('creates a new instance with contactedAt set and submittedAt null', async () => {
      await TaxReportService.markContacted(CLIENT_ID, RULE_ID, PERIOD, DUE_DATE)
      const record = await TaxReportService.getInstance(CLIENT_ID, RULE_ID, PERIOD)
      expect(record).toBeDefined()
      expect(record.contactedAt).toBeTypeOf('number')
      expect(record.submittedAt).toBeNull()
    })

    it('updates contactedAt and notes on an existing instance', async () => {
      await TaxReportService.markContacted(CLIENT_ID, RULE_ID, PERIOD, DUE_DATE, 'first note')
      const first = await TaxReportService.getInstance(CLIENT_ID, RULE_ID, PERIOD)

      await new Promise(r => setTimeout(r, 5))
      await TaxReportService.markContacted(CLIENT_ID, RULE_ID, PERIOD, DUE_DATE, 'second note')
      const second = await TaxReportService.getInstance(CLIENT_ID, RULE_ID, PERIOD)

      expect(second.id).toBe(first.id)
      expect(second.contactedAt).toBeGreaterThanOrEqual(first.contactedAt)
      expect(second.notes).toBe('second note')
    })
  })

  describe('markSubmitted', () => {
    it('creates a new instance with both contactedAt and submittedAt', async () => {
      await TaxReportService.markSubmitted(CLIENT_ID, RULE_ID, PERIOD, DUE_DATE)
      const record = await TaxReportService.getInstance(CLIENT_ID, RULE_ID, PERIOD)
      expect(record.contactedAt).toBeTypeOf('number')
      expect(record.submittedAt).toBeTypeOf('number')
    })

    it('preserves the original contactedAt when submitting a previously contacted record', async () => {
      await TaxReportService.markContacted(CLIENT_ID, RULE_ID, PERIOD, DUE_DATE)
      const contacted = await TaxReportService.getInstance(CLIENT_ID, RULE_ID, PERIOD)
      const originalContactedAt = contacted.contactedAt

      await new Promise(r => setTimeout(r, 5))
      await TaxReportService.markSubmitted(CLIENT_ID, RULE_ID, PERIOD, DUE_DATE)
      const submitted = await TaxReportService.getInstance(CLIENT_ID, RULE_ID, PERIOD)

      expect(submitted.contactedAt).toBe(originalContactedAt)
      expect(submitted.submittedAt).toBeTypeOf('number')
      expect(submitted.submittedAt).toBeGreaterThan(originalContactedAt)
    })
  })

  describe('resetStatus', () => {
    it('deletes the instance record entirely', async () => {
      await TaxReportService.markContacted(CLIENT_ID, RULE_ID, PERIOD, DUE_DATE)
      const before = await TaxReportService.getInstance(CLIENT_ID, RULE_ID, PERIOD)
      expect(before).toBeDefined()

      await TaxReportService.resetStatus(before.id)

      const after = await TaxReportService.getInstance(CLIENT_ID, RULE_ID, PERIOD)
      expect(after).toBeUndefined()
    })
  })
})
