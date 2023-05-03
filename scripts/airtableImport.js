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

async function writeTableData(airtableTable) {
  const jsonlContents = [];

  base.table(airtableTable['id']).select().eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(function(record) {
      jsonlContents.push(JSON.stringify(mapRecordForConvex(record)));
    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    fetchNextPage();

  }, function done(err) {
    if (err) { console.error(err); return; }
    const convexTableName = sanitizeIdentifierForConvex(airtableTable['name'])
    fs.writeFile(`./airtableData/${convexTableName}.jsonl`, jsonlContents.join('\n'), err => {
      if (err) { console.error(err); return; }
    })
  });
}


async function airtableImport() {
  const metadataResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: new Headers({
      'Authorization': `Bearer ${process.env['AIRTABLE_API_KEY']}`
    })
  })

  const data = await metadataResponse.json();
  const tables = data['tables'];
  const linkedFieldData = [];
  const convexTableNameByTableId = {};
  const tableNamesByConvexTableNames = {}
  for (const table of tables) {
    const convexTableName = sanitizeIdentifierForConvex(table['name'])
    convexTableNameByTableId[table['id']] = convexTableName;
    if (tableNamesByConvexTableNames[convexTableName]) {
      console.warn(`Your airtable tables named ${table['name']} and ${tableNamesByConvexTableNames[convexTableName]} will collide in Convex. Please rename and try again`)
      return "Table name collision";
    } else {
      tableNamesByConvexTableNames[convexTableName] = table['name']
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

  await fs.promises.mkdir('./airtableData')
  for (const table of tables) {
    await writeTableData(table)

    //const tableSchema = convertAirtableSchemaToConvex(table['fields'])
    const linkedFields = table['fields'].filter((field) => field['type'] === 'multipleRecordLinks')
    for (const linkField of linkedFields) {
      linkedFieldData.push({
        tableName: convexTableNameByTableId[table['id']],
        fieldId: linkField['id'],
        fieldName: sanitizeIdentifierForConvex(linkField['name']),
        targetTableName: convexTableNameByTableId[linkField['options']['linkedTableId']],
      })
    }
  }
  console.log(linkedFieldData)

  return "Done"
}

airtableImport().then((r) => {
  console.log(r)
})

/*
//
- batching. airtable is every 100 by default; convex can take up to ~8k at a time. do this via files.


- images: actually get them and host them on convex, because airtable I believe now expires those links


- convex can automatically detect a schema and it ain't bad. field types to improve:
- images
- things that should be enum like single or multiple select
- linked record ie foreign key fields
- list of all airtable field types



ideas:
- can we autogenerate the convex schema from the airtable base schema? but with more enum stuff

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
