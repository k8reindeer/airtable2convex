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
    let count = 0
    let migrated = 0
    for await (const record of db.query(tableName)) {
      count += 1;
      const airtableIds = record[fieldId];
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
        await db.patch(record._id, {[fieldName]: convexIds})
        migrated += 1;
      }
    }
    console.log(`Migrated ${migrated} records (of ${count}) in ${tableName}`);
  }}

})
// TODO automate the schema updating process:
// generate initial convex schema based on airtable schema which includes indexes on all airtableId fields
// once the migration is done, provide updated schema with linked fields validated to the right table
// v.array(v.string()) ---> v.array(v.id(targetTableName))