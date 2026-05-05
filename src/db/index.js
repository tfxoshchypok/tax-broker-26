import Dexie from 'dexie'

export const db = new Dexie('MiniBuh')

db.version(1).stores({
  clients:      '++id, lastName, email, phone, company, status, clientType, createdAt',
  interactions: '++id, clientId, type, date',
  tags:         '++id, &name',
  clientTags:   '++id, clientId, tagId',
})

export const { clients, interactions, tags, clientTags } = db
