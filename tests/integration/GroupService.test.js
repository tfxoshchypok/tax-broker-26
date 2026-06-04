import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db } from '@/db/index.js'
import { GroupService } from '@/services/GroupService.js'

beforeAll(async () => {
  await db.open()
})

afterAll(() => {
  db.close()
})

beforeEach(async () => {
  await db.groups.clear()
  await db.clients.clear()
})

// ─── helpers ────────────────────────────────────────────────────────────────

async function addGroup(name = 'Група А', extra = {}) {
  const id = await db.groups.add({ name, contactPerson: '', contactPhone: '', createdAt: Date.now(), ...extra })
  return { id, name, ...extra }
}

async function addClient(overrides = {}) {
  const id = await db.clients.add({
    firstName: 'Іван',
    lastName: 'Тест',
    clientType: 'individual',
    status: 'active',
    createdAt: Date.now(),
    ...overrides,
  })
  return id
}

// ─── getAll ──────────────────────────────────────────────────────────────────

describe('GroupService.getAll', () => {
  it('returns empty array when no groups exist', async () => {
    const result = await GroupService.getAll()
    expect(result).toEqual([])
  })

  it('returns all groups sorted alphabetically by name', async () => {
    await addGroup('Горобина')
    await addGroup('Акація')
    await addGroup('Береза')

    const result = await GroupService.getAll()
    expect(result.map(g => g.name)).toEqual(['Акація', 'Береза', 'Горобина'])
  })
})

// ─── create ──────────────────────────────────────────────────────────────────

describe('GroupService.create', () => {
  it('persists a group with all provided fields and sets createdAt', async () => {
    const before = Date.now()
    const id = await GroupService.create({
      name: 'ТОВ Ромашка',
      contactPerson: 'Іванов Іван',
      contactPhone: '+380501234567',
    })
    const record = await db.groups.get(id)

    expect(record).toBeDefined()
    expect(record.name).toBe('ТОВ Ромашка')
    expect(record.contactPerson).toBe('Іванов Іван')
    expect(record.contactPhone).toBe('+380501234567')
    expect(record.createdAt).toBeGreaterThanOrEqual(before)
  })

  it('returns a numeric id', async () => {
    const id = await GroupService.create({ name: 'Тест' })
    expect(id).toBeTypeOf('number')
  })
})

// ─── update ──────────────────────────────────────────────────────────────────

describe('GroupService.update', () => {
  it('updates the specified fields', async () => {
    const { id } = await addGroup('Стара назва')
    await GroupService.update(id, { name: 'Нова назва', contactPerson: 'Петренко' })

    const record = await db.groups.get(id)
    expect(record.name).toBe('Нова назва')
    expect(record.contactPerson).toBe('Петренко')
  })

  it('does not affect other groups', async () => {
    const { id: id1 } = await addGroup('Група 1')
    const { id: id2 } = await addGroup('Група 2')

    await GroupService.update(id1, { name: 'Група 1 оновлена' })

    const group2 = await db.groups.get(id2)
    expect(group2.name).toBe('Група 2')
  })
})

// ─── remove ──────────────────────────────────────────────────────────────────

describe('GroupService.remove', () => {
  it('deletes the group record', async () => {
    const { id } = await addGroup('Для видалення')
    await GroupService.remove(id)

    const record = await db.groups.get(id)
    expect(record).toBeUndefined()
  })

  it('clears groupId on all clients that belonged to the deleted group', async () => {
    const { id: groupId } = await addGroup('Група X')
    const clientId1 = await addClient({ groupId })
    const clientId2 = await addClient({ groupId })

    await GroupService.remove(groupId)

    const client1 = await db.clients.get(clientId1)
    const client2 = await db.clients.get(clientId2)
    expect(client1.groupId).toBeNull()
    expect(client2.groupId).toBeNull()
  })

  it('does not delete clients when their group is removed', async () => {
    const { id: groupId } = await addGroup('Тимчасова')
    const clientId = await addClient({ groupId })

    await GroupService.remove(groupId)

    const client = await db.clients.get(clientId)
    expect(client).toBeDefined()
    expect(client.lastName).toBe('Тест')
  })

  it('does not affect clients that belong to a different group', async () => {
    const { id: groupA } = await addGroup('Група A')
    const { id: groupB } = await addGroup('Група B')
    const clientId = await addClient({ groupId: groupB })

    await GroupService.remove(groupA)

    const client = await db.clients.get(clientId)
    expect(client.groupId).toBe(groupB)
  })

  it('does not affect clients without any group', async () => {
    const { id: groupId } = await addGroup('Видалювана')
    const clientId = await addClient({ groupId: null })

    await GroupService.remove(groupId)

    const client = await db.clients.get(clientId)
    expect(client.groupId).toBeNull()
  })
})

// ─── setMembers ────────────────────────────────────────────────────────────────

describe('GroupService.setMembers', () => {
  it('assigns groupId to all listed clients', async () => {
    const { id: groupId } = await addGroup('Цільова')
    const c1 = await addClient({ groupId: null })
    const c2 = await addClient({ groupId: null })

    await GroupService.setMembers(groupId, [c1, c2])

    expect((await db.clients.get(c1)).groupId).toBe(groupId)
    expect((await db.clients.get(c2)).groupId).toBe(groupId)
  })

  it('clears groupId from clients removed from the group', async () => {
    const { id: groupId } = await addGroup('Група')
    const keep = await addClient({ groupId })
    const drop = await addClient({ groupId })

    await GroupService.setMembers(groupId, [keep])

    expect((await db.clients.get(keep)).groupId).toBe(groupId)
    expect((await db.clients.get(drop)).groupId).toBeNull()
  })

  it('reassigns a client from another group (one group per client)', async () => {
    const { id: groupA } = await addGroup('A')
    const { id: groupB } = await addGroup('B')
    const client = await addClient({ groupId: groupA })

    await GroupService.setMembers(groupB, [client])

    expect((await db.clients.get(client)).groupId).toBe(groupB)
  })

  it('empty list clears all members of the group', async () => {
    const { id: groupId } = await addGroup('Спорожнити')
    const c1 = await addClient({ groupId })
    const c2 = await addClient({ groupId })

    await GroupService.setMembers(groupId, [])

    expect((await db.clients.get(c1)).groupId).toBeNull()
    expect((await db.clients.get(c2)).groupId).toBeNull()
  })

  it('does not touch clients of other groups', async () => {
    const { id: groupA } = await addGroup('A')
    const { id: groupB } = await addGroup('B')
    const other = await addClient({ groupId: groupB })
    const target = await addClient({ groupId: null })

    await GroupService.setMembers(groupA, [target])

    expect((await db.clients.get(other)).groupId).toBe(groupB)
  })

  it('updates updatedAt on changed clients', async () => {
    const { id: groupId } = await addGroup('Група')
    const client = await addClient({ groupId: null })
    const before = Date.now()

    await GroupService.setMembers(groupId, [client])

    expect((await db.clients.get(client)).updatedAt).toBeGreaterThanOrEqual(before)
  })
})

// ─── getClientCounts ─────────────────────────────────────────────────────────

describe('GroupService.getClientCounts', () => {
  it('returns empty object when no clients have a group', async () => {
    await addGroup('Пуста')
    await addClient({ groupId: null })

    const counts = await GroupService.getClientCounts()
    expect(counts).toEqual({})
  })

  it('returns correct count for each group', async () => {
    const { id: gA } = await addGroup('A')
    const { id: gB } = await addGroup('B')

    await addClient({ groupId: gA })
    await addClient({ groupId: gA })
    await addClient({ groupId: gB })

    const counts = await GroupService.getClientCounts()
    expect(counts[gA]).toBe(2)
    expect(counts[gB]).toBe(1)
  })

  it('ignores clients without a group', async () => {
    const { id: gA } = await addGroup('A')
    await addClient({ groupId: gA })
    await addClient({ groupId: null })

    const counts = await GroupService.getClientCounts()
    expect(counts[gA]).toBe(1)
    expect(Object.keys(counts)).toHaveLength(1)
  })
})
