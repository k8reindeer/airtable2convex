import {Doc, TableNames} from "../_generated/dataModel";
import { genericMigration } from "../lib/migrations";

type LinkedFieldData<TableName extends TableNames> = {
  airtableIdField: keyof Doc<TableName>;
  convexIdField: keyof Doc<TableName>;
  targetTableName: TableNames;
}

export default genericMigration({
  migrateDoc: async ({db}, doc, {airtableIdField, convexIdField, targetTableName}: LinkedFieldData<TableNames>) => {
    const airtableIds = doc[airtableIdField];
    if (airtableIds && Array.isArray(airtableIds)) {
      const convexIds = []
      for (const airtableId of airtableIds) {

        // @ts-ignore This will just fail if the target table isn't indexed by airtble id, and the system error message is good enough
        const convexRecord = await db.query(targetTableName).withIndex("by_airtable_id", q => q.eq('airtableId', airtableId)).unique();
        if (convexRecord) {
          convexIds.push(convexRecord._id);
        } else {
          console.warn(`Document with airtable ID ${airtableId} not found in ${targetTableName}`)
        }
      }
      delete doc[airtableIdField];
      doc[convexIdField] = convexIds as any;
      await db.replace(doc._id, doc);
    }
  }
})
