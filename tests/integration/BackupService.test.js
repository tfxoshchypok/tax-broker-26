import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db } from '@/db/index.js'
import { BackupService, backupTableNames } from '@/modules/backup/services/BackupService.js'
import { APP_ID } from '@/modules/backup/engine/serializer.js'

beforeAll(async () => {
  await db.open()
})

afterAll(() => {
  db.close()
})

async function seed() {
  await db.clients.bulkAdd([
    { id: 1, lastName: 'Шевченко', status: 'active', clientType: 'fop', createdAt: 1 },
    { id: 2, lastName: 'Франко', status: 'lead', clientType: 'individual', createdAt: 2 },
  ])
  await db.tags.bulkAdd([{ id: 1, name: 'VIP' }])
  await db.invoices.bulkAdd([
    { id: 10, clientId: 1, period: '2025-01', number: 'A-1', status: 'draft', createdAt: 3 },
  ])
}

async function clearAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}

beforeEach(clearAll)

describe('backupTableNames', () => {
  it('returns every table in the Dexie schema', () => {
    const names = backupTableNames()
    expect(names).toEqual(db.tables.map(t => t.name))
    expect(names).toContain('clients')
    expect(names).toContain('paymentInvoices')
  })
})

describe('exportAll', () => {
  it('produces a valid envelope with all rows', async () => {
    await seed()
    const env = await BackupService.exportAll()
    expect(env.app).toBe(APP_ID)
    expect(env.dbVersion).toBe(db.verno)
    expect(env.data.clients).toHaveLength(2)
    expect(env.data.tags).toHaveLength(1)
    expect(env.data.invoices).toHaveLength(1)
  })
})

describe('importReplace', () => {
  it('round-trips: export → clear → importReplace restores data with ids', async () => {
    await seed()
    const env = await BackupService.exportAll()
    await clearAll()
    expect(await db.clients.count()).toBe(0)

    await BackupService.importReplace(env)

    expect(await db.clients.count()).toBe(2)
    expect((await db.clients.get(1)).lastName).toBe('Шевченко')
    expect((await db.invoices.get(10)).number).toBe('A-1')
  })

  it('overwrites existing data entirely', async () => {
    await seed()
    const env = await BackupService.exportAll()
    await clearAll()
    await db.clients.add({ id: 99, lastName: 'Інший', status: 'active', clientType: 'fop', createdAt: 5 })

    await BackupService.importReplace(env)

    expect(await db.clients.get(99)).toBeUndefined()
    expect(await db.clients.count()).toBe(2)
  })

  it('reports tables present in the file but absent from the schema', async () => {
    const env = {
      app: APP_ID,
      formatVersion: 1,
      data: { clients: [], obsoleteTable: [{ id: 1 }] },
    }
    const { dropped } = await BackupService.importReplace(env)
    expect(dropped).toEqual(['obsoleteTable'])
  })

  it('throws on a foreign file', async () => {
    await expect(BackupService.importReplace({ app: 'x', formatVersion: 1, data: {} }))
      .rejects.toThrow(/Mini BUH/)
  })
})

describe('importMerge', () => {
  it('updates existing rows and adds new ones without duplicates', async () => {
    await seed()
    const env = {
      app: APP_ID,
      formatVersion: 1,
      data: {
        clients: [
          { id: 1, lastName: 'Шевченко-Оновлений', status: 'active', clientType: 'fop', createdAt: 1 },
          { id: 3, lastName: 'Новий', status: 'active', clientType: 'fop', createdAt: 4 },
        ],
      },
    }
    await BackupService.importMerge(env)

    expect(await db.clients.count()).toBe(3) // 1,2 існували + 3 доданий
    expect((await db.clients.get(1)).lastName).toBe('Шевченко-Оновлений')
    expect((await db.clients.get(2)).lastName).toBe('Франко') // не зачеплено
    expect((await db.clients.get(3)).lastName).toBe('Новий')
  })
})
