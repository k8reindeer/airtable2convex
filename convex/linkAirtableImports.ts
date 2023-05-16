import {Doc, TableNames} from "./_generated/dataModel";
import { genericMigration } from "./lib/migrations";

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
        // look up the convex record in targetTableName with this airtableId

        // TODO make sure the target table is indexed on the airtable id
        const convexRecord = await db.query(targetTableName).withIndex("by_airtable_id", q => q.eq('airtableId', airtableId)).unique();
        if (convexRecord) {
          convexIds.push(convexRecord._id);
        } else {
          console.warn(`Document with airtable ID ${airtableId} not found in ${targetTableName}`)
        }
      }
      await db.patch(doc._id, {[convexIdField]: convexIds})
    }
  }
})