import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { migrateNotesFirstLineToIpn } from '@/db/index.js'

describe('migrateNotesFirstLineToIpn (трансформація запису)', () => {
  it('фіз/ФОП: переносить перший рядок з 10 цифр і прибирає його з нотаток', () => {
    const c = { clientType: 'fop', notes: '1234567890\nПостійний клієнт\nдзвонити зранку' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBe('1234567890')
    expect(c.notes).toBe('Постійний клієнт\nдзвонити зранку')
  })

  it('юрособа: переносить перший рядок з 8 цифр (ЄДРПОУ)', () => {
    const c = { clientType: 'legal', notes: '12345678\nконтрагент' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBe('12345678')
    expect(c.notes).toBe('контрагент')
  })

  it('тип за замовчуванням (без clientType) очікує 10 цифр', () => {
    const c = { notes: '1234567890' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBe('1234567890')
    expect(c.notes).toBe('')
  })

  it('обрізає пробіли першого рядка перед перевіркою', () => {
    const c = { clientType: 'individual', notes: '  1234567890  \nрешта' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBe('1234567890')
    expect(c.notes).toBe('решта')
  })

  it('юрособа: 10-значний перший рядок не підходить (треба 8) — пропуск', () => {
    const c = { clientType: 'legal', notes: '1234567890\nтекст' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBeUndefined()
    expect(c.notes).toBe('1234567890\nтекст')
  })

  it('фіз/ФОП: 8-значний перший рядок не підходить (треба 10) — пропуск', () => {
    const c = { clientType: 'fop', notes: '12345678\nтекст' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBeUndefined()
    expect(c.notes).toBe('12345678\nтекст')
  })

  it('перший рядок з нецифровими символами — пропуск', () => {
    const c = { clientType: 'fop', notes: '1234567890 - основний\nтекст' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBeUndefined()
    expect(c.notes).toBe('1234567890 - основний\nтекст')
  })

  it('не чіпає клієнта, якщо ipn уже заповнено', () => {
    const c = { clientType: 'fop', ipn: '0000000000', notes: '9999999999\nтекст' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBe('0000000000')
    expect(c.notes).toBe('9999999999\nтекст')
  })

  it('не чіпає клієнта без нотаток', () => {
    const c = { clientType: 'fop', notes: '' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBeUndefined()
    expect(c.notes).toBe('')
  })

  it('порожній перший рядок (нотатки починаються з пустого рядка) — пропуск', () => {
    const c = { clientType: 'fop', notes: '\n1234567890' }
    migrateNotesFirstLineToIpn(c)
    expect(c.ipn).toBeUndefined()
    expect(c.notes).toBe('\n1234567890')
  })
})

describe('Dexie upgrade v13 → v14 (одноразовий скрипт)', () => {
  it('після апгрейду переносить перший рядок нотаток у ipn', async () => {
    const name = `MigTest_${Date.now()}`

    // Стара БД (до ipn): мінімальна v13-схема clients.
    const oldDb = new Dexie(name)
    oldDb.version(13).stores({ clients: '++id, lastName' })
    await oldDb.open()
    await oldDb.table('clients').bulkAdd([
      { lastName: 'Іваненко',  clientType: 'fop',   notes: '1234567890\nVIP' },
      { lastName: 'Петренко',  clientType: 'fop',   ipn: '0000000000', notes: '9999999999\nне чіпати' },
      { lastName: 'Ковальчук', clientType: 'legal', notes: '12345678\nконтрагент' },
      { lastName: 'Бондар',    clientType: 'legal', notes: '1234567890\nневірна довжина' },
      { lastName: 'Сидоренко', clientType: 'fop',   notes: '' },
    ])
    oldDb.close()

    // Нова БД з тією самою назвою: v14 з індексом ipn + та сама міграція.
    const newDb = new Dexie(name)
    newDb.version(13).stores({ clients: '++id, lastName' })
    newDb.version(14).stores({ clients: '++id, lastName, ipn' })
      .upgrade(tx => tx.table('clients').toCollection().modify(migrateNotesFirstLineToIpn))
    await newDb.open()

    const rows = await newDb.table('clients').orderBy('lastName').toArray()
    const byName = Object.fromEntries(rows.map(r => [r.lastName, r]))

    expect(byName['Іваненко'].ipn).toBe('1234567890')
    expect(byName['Іваненко'].notes).toBe('VIP')
    expect(byName['Петренко'].ipn).toBe('0000000000') // не перезаписано
    expect(byName['Петренко'].notes).toBe('9999999999\nне чіпати')
    expect(byName['Ковальчук'].ipn).toBe('12345678')  // юрособа, 8 цифр
    expect(byName['Ковальчук'].notes).toBe('контрагент')
    expect(byName['Бондар'].ipn).toBeUndefined()       // юрособа, 10 цифр — не підходить
    expect(byName['Бондар'].notes).toBe('1234567890\nневірна довжина')
    expect(byName['Сидоренко'].ipn).toBeUndefined()

    // Пошук за індексом ipn працює.
    const found = await newDb.table('clients').where('ipn').equals('1234567890').first()
    expect(found?.lastName).toBe('Іваненко')

    newDb.close()
    await Dexie.delete(name)
  })
})
