import { db } from '@/db/index.js'

// Per-client assignments of an individual report type:
// { clientId, typeId, dueDate (anchor deadline ts), leadDays, createdAt }
export const IndividualReportService = {
  getAll: () => db.individualReports.toArray(),

  getByClientId: (clientId) =>
    db.individualReports.where('clientId').equals(Number(clientId)).toArray(),

  add: (data) =>
    db.individualReports.add({ ...data, clientId: Number(data.clientId), createdAt: Date.now() }),

  update: (id, data) => db.individualReports.update(Number(id), data),

  remove: (id) => db.individualReports.delete(Number(id)),
}
