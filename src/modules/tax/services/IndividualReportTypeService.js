import { db } from '@/db/index.js'

export const IndividualReportTypeService = {
  getAll: () => db.individualReportTypes.orderBy('id').toArray(),

  add: (data) => db.individualReportTypes.add(data),

  update: (id, data) => db.individualReportTypes.update(Number(id), data),

  async isReferenced(typeId) {
    const count = await db.individualReports.where('typeId').equals(Number(typeId)).count()
    return count > 0
  },

  remove: (id) => db.individualReportTypes.delete(Number(id)),
}
