const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

const BASE_ID = 'appXw3Dbn5Sd6G7mp'
const base = require('airtable').base(BASE_ID);


function sanitizeIdentifierForConvex(airtableFieldName) {
  // Identifiers can only contain alphanumeric characters or underscores
  return airtableFieldName.replace(' ', '_').replace(/\W/g, '')
}

function mapRecordForConvex(airtableRecord) {
  const convexRecord = {
    airtableId: airtableRecord.getId(),
    // TODO perhaps rename any linked record fields with an airtable_ prefix, so we can use the real name for the convex id links?
  }

  for (const f in airtableRecord.fields) {
    convexRecord[sanitizeIdentifierForConvex(f)] = airtableRecord.get(f)
  }

  return convexRecord
}

async function writeTableData(airtableTableId, convexTableName) {
  const jsonlContents = [];

  base.table(airtableTableId).select().eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(function(record) {
      jsonlContents.push(JSON.stringify(mapRecordForConvex(record)));
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


async function airtableImport() {
  const tableNamesFilename = './airtableData/tableNames.jsonl';
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

  await fs.promises.mkdir('./airtableData/tableData', { recursive: true });
  for (const airtableTableId of Object.keys(convexTableNameByAirtableTableId)) {
    const convexTableName = convexTableNameByAirtableTableId[airtableTableId]
    await writeTableData(airtableTableId, convexTableName)
    console.log(`npx convex import ${convexTableName} airtableData/tableData/${convexTableName}.jsonl`)

    //const tableSchema = convertAirtableSchemaToConvex(table['fields'])
    const linkedFields = tableByTableId[airtableTableId]['fields'].filter((field) => field['type'] === 'multipleRecordLinks')
    for (const linkField of linkedFields) {
      const targetTableName = convexTableNameByAirtableTableId[linkField['options']['linkedTableId']]
      if (targetTableName !== undefined) {
        // Only include the link field if the source and target tables were included in the convex import
        linkedFieldData.push({
          tableName: convexTableName,
          fieldId: linkField['id'],
          fieldName: sanitizeIdentifierForConvex(linkField['name']),
          targetTableName,
        })
      }
    }
  }
  await fs.promises.writeFile(`./airtableData/linkedFields.json`, JSON.stringify(linkedFieldData))

  return "Done"
}

airtableImport().then((r) => {
  console.log(r)
})

/*
//
- batching. airtable is every 100 by default; convex can take up to ~8k at a time. do this via files.


- images: actually get them and host them on convex, because airtable I believe now expires those links


autogenerate the convex schema from the airtable base schema
- images
- things that should be enum like single or multiple select
- linked record ie foreign key fields
- list of all airtable field types

TABLE renaming strategy:
- beginAirtableImport.js
-- generates tableNames.jsonl
-- user modifies tableNames.jsonl to contain both airtable and convex names (correspondence)
- airtableImport.js
-- downloads the airtable data into jsonl
-- generates the convex import statements for the user to run on the command line with the names they chose
-- generates the schema for the tables, to add to schema.ts, with the by_airtable_id index
-- writes linkedFields.json that corresponds airtable table names, convex table names, field names, etc
- airtableLink.js
-- reads the linkedFields.json to determine which fields have links
-- calls the convex mutation to fix up the airtable ids into convex ids

research
- does convex schema allow validating that options are from an enum? (YES)
validators v: It additionally allows you to define unions, optional property, string literals, and more
defineTable({
  oneTwoOrThree: v.union(
    v.literal("one"),
    v.literal("two"),
    v.literal("three")
  ),
});

- does convex files support the images the way I hope it does? https://docs.convex.dev/file-storage/store-files
- make a frontend to show my bridesmaids dresses?

*/
