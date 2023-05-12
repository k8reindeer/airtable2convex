const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

const BASE_ID = 'appXw3Dbn5Sd6G7mp'
const base = require('airtable').base(BASE_ID);


function sanitizeIdentifierForConvex(airtableFieldName) {
  // Identifiers can only contain alphanumeric characters or underscores
  return airtableFieldName.replaceAll(' ', '_').replace(/\W/g, '')
}

function mapRecordForConvex(airtableRecord, linkedFieldIdByName) {
  const convexRecord = {
    airtableId: airtableRecord.getId(),
  }

  for (const f in airtableRecord.fields) {
    const linkedFieldId = linkedFieldIdByName[f];
    if (linkedFieldId !== undefined) {
      // for linked fields, create two fields in convex:
      // The field named by the airtable field ID will hold airtable IDs
      convexRecord[linkedFieldId] = airtableRecord.get(f)
      // And create an empty list field with the human-readable name, to be populated with the convex IDs
      convexRecord[sanitizeIdentifierForConvex(f)] = []
    } else {
      convexRecord[sanitizeIdentifierForConvex(f)] = airtableRecord.get(f)
    }
  }

  return convexRecord
}

async function writeTableData(airtableTableId, convexTableName, linkedFieldsToInclude) {
  const jsonlContents = [];

  const linkedFieldIdByName = {}
  for (const linkedField of linkedFieldsToInclude) {
    linkedFieldIdByName[linkedField['name']] = linkedField['id']
  }

  base.table(airtableTableId).select().eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(function(record) {
      jsonlContents.push(JSON.stringify(mapRecordForConvex(record, linkedFieldIdByName)));
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


function generateTableSchema(fields, convexTableNameByAirtableTableId) {
  const convexSchemaByFieldName = {}
  for (const f of fields) {
    const fieldName = sanitizeIdentifierForConvex(f['name'])

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
          convexSchemaByFieldName[f['id']] = `v.array(v.id('${targetTableName}'))`;
          convexSchemaByFieldName[fieldName] = 'v.array(v.string())';
        }
        break;
      case 'singleSelect':
        const options =
        convexSchemaByFieldName[fieldName] = `v.union(
${f['options']['choices'].map(({name}) => `      v.literal("${name}"),`).join('\n')}
    )`;
        break;
      case 'multipleSelects':
        convexSchemaByFieldName[fieldName] = `v.array(v.union(
${f['options']['choices'].map(({name}) => `      v.literal("${name}"),`).join('\n')}
    ))`;
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
  const schemaCode = `import { defineSchema, defineTable } from "convex/schema";
import { v } from "convex/values";

export default defineSchema({
${tableSchemas.join('\n')}
});`

  await fs.promises.writeFile(`./convex/airtableSchema.ts`, schemaCode)
  console.log(`A suggested convex schema file has been written at convex/airtableSchema.ts
Review, modify, and incorporate it into your schema.ts, then wait for convex to build the indexes before running
node scripts/airtableLink.js`)

}

async function airtableImport() {
  const tableNamesFilename = './airtableData/tableNames.json';
  const convexTableNameByAirtableTableId = {}
  const tableNames = await fs.promises.readFile(tableNamesFilename, 'utf8');
  for (const tableNaming of tableNames.toString().split('\n')) {
    const {airtableTableId, convexTableName} = JSON.parse(tableNaming);
    convexTableNameByAirtableTableId[airtableTableId] = convexTableName
  }

  const metadataResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: new Headers({
      'Authorization': `Bearer ${process.env['AIRTABLE_API_KEY']}`
    })
  })

  const data = await metadataResponse.json();
  const tables = data['tables'];
  const linkedFieldData = [];
  const convexTableNames = new Set();
  const tableByTableId = {}

  for (const table of tables) {
    tableByTableId[table['id']] = table;
    const convexTableName = convexTableNameByAirtableTableId[table['id']]
    if (convexTableName === undefined) {
      // skip the tables the user has removed from ./airtableData/tableNames.jsonl
      continue
    }

    if (convexTableNames.has(convexTableName)) {
      console.warn(`Multiple tables would be named ${convexTableName} in Convex. Please rename in ${tableNamesFilename}`)
      return "Table name collision";
    } else {
      convexTableNames.add(convexTableName);
    }

    const fieldNamesByConvexFieldNames = {}
    for (const field of table['fields']) {
      const convexFieldName = sanitizeIdentifierForConvex(field['name'])
      if (fieldNamesByConvexFieldNames[convexFieldName]) {
        console.warn(`Your airtable fields named ${field['name']} and ${fieldNamesByConvexFieldNames[convexFieldName]} (table ${table['name']}) will collide in Convex. Please rename and try again`)
        return "Field name collision";
      } else {
        fieldNamesByConvexFieldNames[convexFieldName] = field['name']
       }

    }
  }

  const schemasByTableName = {};

  await fs.promises.mkdir('./airtableData/tableData', { recursive: true });
  for (const airtableTableId of Object.keys(convexTableNameByAirtableTableId)) {
    const convexTableName = convexTableNameByAirtableTableId[airtableTableId]
    const allFields = tableByTableId[airtableTableId]['fields']
    const linkedFieldsToInclude = []

    schemasByTableName[convexTableName] = generateTableSchema(allFields, convexTableNameByAirtableTableId)
    for (const linkField of allFields.filter((field) => field['type'] === 'multipleRecordLinks')) {
      const targetTableName = convexTableNameByAirtableTableId[linkField['options']['linkedTableId']]
      if (targetTableName !== undefined) {
        // Only include the link field if the source and target tables were included in the convex import
        linkedFieldsToInclude.push(linkField)
        linkedFieldData.push({
          tableName: convexTableName,
          fieldId: linkField['id'],
          fieldName: sanitizeIdentifierForConvex(linkField['name']),
          targetTableName,
        })
      }
    }

    await writeTableData(airtableTableId, convexTableName, linkedFieldsToInclude)
    console.log(`npx convex import ${convexTableName} airtableData/tableData/${convexTableName}.jsonl`)
  }
  await fs.promises.writeFile(`./airtableData/linkedFields.json`, JSON.stringify(linkedFieldData, null, 2))
  await writeSchemaFile(schemasByTableName);

  return "Done"
}

airtableImport().then((r) => {
  console.log(r)
})

/*

- batching. airtable is every 100 by default; convex can take up to ~8k at a time. do this via files.


- images: actually get them and host them on convex, because airtable I believe now expires those links
- lookup and rollup fields -- after the migration they could be out of date -- potentially don't migrate them at all??

- does convex files support the images the way I hope it does? https://docs.convex.dev/file-storage/store-files
- make a frontend to show my bridesmaids dresses?

TODO airtable field types:

derived data, and post-migration could quickly get out of date... warn or refuse to migrate these values?
- multipleLookupValues
- multipleRecordLinks
- rollup
- formula
- count

will not remain accurate and shouldn't be migrated
- lastModifiedTime
- lastModifiedBy

doesn't make sense to want in convex
- button


DONE / convex coded up
multipleSelects
singleSelect
checkbox
singleLineText
multilineText
richText
currency
number
url
date
dateTime
duration
email
phoneNumber
rating
percent

TODO to code up
autoNumber
barcode
createdBy
createdTime
externalSyncSource
multipleAttachments ie IMAGES!!
multipleCollaborators
singleCollaborator

*/
