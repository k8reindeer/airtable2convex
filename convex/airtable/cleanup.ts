import { genericMigration } from "../lib/migrations";


export const removeAirtableId  = genericMigration({
  migrateDoc: async ({db}, doc) => {
    // @ts-ignore It's fine if the table doesn't have an airtableId field, since we want to remove it anyway
    delete doc.airtableId;
    await db.replace(doc._id, doc);
  }
});