import { mutation } from './_generated/server';
import {Doc, TableNames} from "./_generated/dataModel";


type LinkedFieldData<TableName extends TableNames> = {
  tableName: TableName;
  fieldId: keyof Doc<TableName>;
  fieldName: keyof Doc<TableName>;
  targetTableName: TableNames;
}
export default mutation(async ({db}, {linkedFields}: {linkedFields: LinkedFieldData<TableNames>[]}) => {
  // before any of this!
  // - gather all the target tables for each link field and make sure each is indexed on the airtableId column
  console.log(linkedFields)
  for (const {tableName, fieldId, fieldName, targetTableName} of linkedFields) {{
    // TODO let this be an async iterator
    const records = await db.query(tableName).collect();
    for (const record of records) {
      // TODO validate that this is a list of strings...
      const airtableIds = record[fieldId];
      if (airtableIds) {
        const convexIds = []
        for (const airtableId of airtableIds as unknown as string[]) {
          // look up the convex record in targetTableName with this airtableId

          // TODO make sure the target table is indexed on the airtable id
          const convexRecord = await db.query(targetTableName).withIndex("by_airtable_id", q => q.eq('airtableId', airtableId)).unique();
          if (convexRecord) {
            convexIds.push(convexRecord._id);
          } // TODO warn if not found
        }
        await db.patch(record._id, {[fieldName]: convexIds})
      }

    }
    console.log(`Migrated ${records.length} records in ${tableName}`);
  }}

})
// TODO automate the schema updating process:
// generate initial convex schema based on airtable schema which includes indexes on all airtableId fields
// once the migration is done, provide updated schema with linked fields validated to the right table
// v.array(v.string()) ---> v.array(v.id(targetTableName))