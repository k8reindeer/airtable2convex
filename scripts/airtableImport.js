const fs = require('fs');
require("dotenv").config({ path: ".env.local" });


function mapRecordForConvex(airtableRecord, convexFieldNameByAirtableFieldId, linkedFieldIdsToInclude) {
  const convexRecord = {
    airtableId: airtableRecord.getId(),
  }

  for (const airtableFieldId of Object.keys(convexFieldNameByAirtableFieldId)) {
    const convexFieldName = convexFieldNameByAirtableFieldId[airtableFieldId];
    if (linkedFieldIdsToInclude.includes(airtableFieldId)) {
      // for linked fields, create two fields in convex:
      // The field named by the airtable field ID will hold airtable IDs
      convexRecord[airtableFieldId] = airtableRecord.get(airtableFieldId)
      // And create an empty list field in the convex field name, to be populated with the convex IDs
      convexRecord[convexFieldName] = []
    } else {
      convexRecord[convexFieldName] = airtableRecord.get(airtableFieldId);
    }
  }
  return convexRecord
}

async function writeTableData(base, airtableTableId, convexTableName, convexFieldNameByAirtableFieldId, linkedFieldIdsToInclude) {
  const jsonlContents = [];

  base.table(airtableTableId).select({returnFieldsByFieldId: true}).eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(function(record) {
      jsonlContents.push(JSON.stringify(mapRecordForConvex(record, convexFieldNameByAirtableFieldId, linkedFieldIdsToInclude)));
    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    fetchNextPage();

  }, function done(err) {
    if (err) { console.error(err);}
    fs.writeFile(`./airtableData/tableData/${convexTableName}.jsonl`, jsonlContents.join('\n'), err => {
      if (err) { console.error(err);}
    })
  });
}


function generateTableSchema(fields, convexFieldNameByAirtableFieldId, convexTableNameByAirtableTableId) {
  const convexSchemaByFieldName = {}
  for (const f of fields) {
    const fieldName = convexFieldNameByAirtableFieldId[f['id']]
    if (fieldName === undefined) {
      // If the user excluded a field from naming.json, don't include it in the schema either
      continue
    }

    switch(f['type']) {
      case 'singleLineText':
      case 'multilineText':
      case 'richText':
      case 'url':
      case 'date':
      case 'dateTime':
      case 'email':
      case 'phoneNumber':
        convexSchemaByFieldName[fieldName] = 'v.string()';
        break;
      case 'currency':
      case 'number':
      case 'duration':
      case 'percent':
      case 'rating':
        convexSchemaByFieldName[fieldName] = 'v.number()';
        break;
      case 'checkbox':
        convexSchemaByFieldName[fieldName] = 'v.boolean()';
        break;
      case 'multipleRecordLinks':
        const targetTableName = convexTableNameByAirtableTableId[f['options']['linkedTableId']];
        // Only import the link field if we're also importing the table it links to
        if (targetTableName) {
          convexSchemaByFieldName[f['id']] = 'v.array(v.string())';
          convexSchemaByFieldName[fieldName] = `v.array(v.id('${targetTableName}'))`;
        }
        break;
      case 'singleSelect':
        convexSchemaByFieldName[fieldName] = `v.union(
${f['options']['choices'].map(({name}) => `      v.literal("${name}"),`).join('\n')}
    )`;
        break;
      case 'multipleSelects':
        convexSchemaByFieldName[fieldName] = `v.array(v.union(
${f['options']['choices'].map(({name}) => `      v.literal("${name}"),`).join('\n')}
    ))`;
        break;
      case 'multipleAttachments':
        convexSchemaByFieldName[fieldName] = `v.array(
      v.object({
        filename: v.string(),
        height: v.number(),
        id: v.string(),
        size: v.number(),
        storageId: v.string(),
        type: v.string(),
        width: v.number(),
      })
    )`;
        break;
      default:
        convexSchemaByFieldName[fieldName] = 'v.any()'
    }
  }
  return convexSchemaByFieldName
}

function formatTableSchema(tableName, schemasByFieldName) {
  const fieldSchemas = []
  for (const fieldName of Object.keys(schemasByFieldName)) {
    // Optionals everywhere since we're not interpreting the data here to see if every value is populated
    fieldSchemas.push(`    ${fieldName}: v.optional(${schemasByFieldName[fieldName]}),`)
  }
  return `  ${tableName}: defineTable({
    airtableId: v.string(),
${fieldSchemas.join('\n')}
  }).index("by_airtable_id", ["airtableId"]),`
}

async function writeSchemaFile(schemasByTableName) {
  const tableSchemas = []
  for (const tableName of Object.keys(schemasByTableName)) {
    tableSchemas.push(formatTableSchema(tableName, schemasByTableName[tableName]))
  }
  const schemaCode = `import { defineTable } from "convex/schema";
import { v } from "convex/values";

const airtableSchemas = {
${tableSchemas.join('\n')}
};

export default airtableSchemas;`

  await fs.promises.writeFile(`./convex/airtableSchema.ts`, schemaCode)
  console.log(`A suggested convex schema file has been written at convex/airtableSchema.ts
Review, modify, and import it into your schema.ts, then wait for convex to build the indexes before running
node scripts/airtableLink.js`)

}

async function airtableImport() {
  const tableNamesFilename = './airtableData/naming.json';
  const convexTableNameByAirtableTableId = {}
  const convexFieldNameByAirtableFieldIdByAirtableTableId = {}
  const tableNames = await fs.promises.readFile(tableNamesFilename, 'utf8');
  const {baseId, tables: jsonTables} = JSON.parse(tableNames.toString())
  const allConvexTableNames = new Set();
  for (const {airtableTableId, convexTableName, fields} of jsonTables) {
    if (allConvexTableNames.has(convexTableName)) {
      console.warn(`Multiple tables would be named ${convexTableName} in Convex. Please rename in ${tableNamesFilename}`)
      return "Table name collision";
    } else {
      allConvexTableNames.add(convexTableName);
    }
    convexTableNameByAirtableTableId[airtableTableId] = convexTableName
    convexFieldNameByAirtableFieldIdByAirtableTableId[airtableTableId] = {}
    const allConvexFieldNamesForThisTable = new Set()
    for (const {airtableFieldId, convexFieldName} of fields) {
      if (allConvexFieldNamesForThisTable.has(convexFieldName)) {
        console.warn(`Multiple fields would be named ${convexFieldName} (in table: ${convexTableName}) in Convex. Please rename in ${tableNamesFilename}`)
        return "Field name collision";
      } else {
        allConvexFieldNamesForThisTable.add(convexFieldName)
        convexFieldNameByAirtableFieldIdByAirtableTableId[airtableTableId][airtableFieldId] = convexFieldName;
      }
    }
  }
  const base = require('airtable').base(baseId);

  const metadataResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: new Headers({
      'Authorization': `Bearer ${process.env['AIRTABLE_API_KEY']}`
    })
  })

  const data = await metadataResponse.json();
  const tables = data['tables'];
  const linkedFieldsByTable = {};
  const attachmentFields = [];
  const tableByTableId = {}
  for (const table of tables) {
    tableByTableId[table['id']] = table;
  }

  const schemasByTableName = {};

  await fs.promises.mkdir('./airtableData/tableData', { recursive: true });
  for (const airtableTableId of Object.keys(convexTableNameByAirtableTableId)) {
    const convexTableName = convexTableNameByAirtableTableId[airtableTableId]
    const convexFieldNameByAirtableFieldId = convexFieldNameByAirtableFieldIdByAirtableTableId[airtableTableId]
    const allFields = tableByTableId[airtableTableId]['fields']
    const linkedFieldIdsToInclude = []

    schemasByTableName[convexTableName] = generateTableSchema(allFields, convexFieldNameByAirtableFieldId, convexTableNameByAirtableTableId)
    for (const linkField of allFields.filter((field) => field['type'] === 'multipleRecordLinks')) {
      const convexFieldName = convexFieldNameByAirtableFieldId[linkField['id']]
      if (convexFieldName === undefined) {
        // Only schedule the link field for linking if it's actually included in the import
        continue
      }
      const targetTableName = convexTableNameByAirtableTableId[linkField['options']['linkedTableId']]
      if (targetTableName === undefined) {
        // Only schedule the link field for linking if the target table is also included in the convex import
        continue
      }

      linkedFieldIdsToInclude.push(linkField['id'])
      const linkedFieldData = {
        airtableIdField: linkField['id'],
        convexIdField: convexFieldName,
        targetTableName,
      }
      if (linkedFieldsByTable[convexTableName]) {
        linkedFieldsByTable[convexTableName].push(linkedFieldData)
      } else {
        linkedFieldsByTable[convexTableName] = [linkedFieldData]
      }
    }

    for (const attachmentField of allFields.filter((field) => field['type'] === 'multipleAttachments') ) {
      const convexFieldName = convexFieldNameByAirtableFieldId[attachmentField['id']]
      if (convexFieldName === undefined) {
        // Only schedule the attachment field for storage if it's actually included in the import
        continue
      }
      attachmentFields.push({table: convexTableName, field: convexFieldName})
    }

    await writeTableData(base, airtableTableId, convexTableName, convexFieldNameByAirtableFieldId, linkedFieldIdsToInclude)
    console.log(`npx convex import ${convexTableName} airtableData/tableData/${convexTableName}.jsonl`)
  }
  await fs.promises.writeFile(`./airtableData/linkedFields.json`, JSON.stringify(linkedFieldsByTable, null, 2))
  await fs.promises.writeFile('./airtableData/attachmentFields.json', JSON.stringify(attachmentFields, null, 2))
  await writeSchemaFile(schemasByTableName);

  return "Done"
}

airtableImport().then((r) => {
  console.log(r)
})

/*




- make a frontend to show my bridesmaids dresses?

TODO airtable field types to create schema for (or skip):
autoNumber
barcode
createdBy
createdTime
externalSyncSource
multipleCollaborators
singleCollaborator

*/
