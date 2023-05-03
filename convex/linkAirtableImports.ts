import { mutation } from './_generated/server';
import {Doc, TableNames} from "./_generated/dataModel";


type LinkedFieldData<TableName extends TableNames> = {
  tableName: TableName;
  fieldName: keyof Doc<TableName>;
  targetTableName: TableNames;
}
export default mutation(async ({db}, {linkedFields}: {linkedFields: LinkedFieldData<TableNames>[]}) => {
  // before any of this!
  // - gather all the target tables for each link field and make sure each is indexed on the airtableId column
  console.log(linkedFields)
  for (const {tableName, fieldName, targetTableName} of linkedFields) {{
    // TODO let this be an async iterator
    const records = await db.query(tableName).collect();
    console.log(records.length);
    for (const record of records) {
      // - in the fieldName, you will find a list of airtable record Ids
      // TODO validate that this is a list of strings...
      const airtableIds = record[fieldName];
      if (airtableIds) {
        const convexIds = []
        for (const airtableId of airtableIds as unknown as string[]) {
          // - for each of those, look up the convex record in targetTableName whose airtableId matches and get its id

          // TODO make sure the target table is indexed on the airtable id
          const convexRecord = await db.query(targetTableName).withIndex("by_airtable_id", q => q.eq('airtableId', airtableId)).unique();
          if (convexRecord) {
            convexIds.push(convexRecord._id);
          } // TODO warn if not found
        }
        // - replace the list of airtable record Ids with the list of convex record ids
        await db.patch(record._id, {[fieldName]: convexIds})
        // TODO oh no! this replacement is not idempotent because it destroys the original information.
        // I think instead we want to create a temp airtable_fieldName for each linked field, and then populate a whole new field
        // with the convex id instead. Then we can delete all the airtable data as a final pass.
      }

    }


  }}

  // optionally: once all of the link fields have been populated, remove the airtableId field from each table (or you know keep it for posterity)

})
// TODO automate the schema updating process:
// generate initial convex schema based on airtable schema which includes indexes on all airtableId fields
// once the migration is done, provide updated schema with linked fields validated to the right table
// v.array(v.string()) ---> v.array(v.id(targetTableName))