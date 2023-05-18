const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

/*
These field types are skipped by the import because for one reason or another,
they rarely make sense to import into Convex. If you really need one of these fields
feel free to comment it out of this list (and keep in mind you'll need to write the
Convex functions to keep that data in sync)
 */

const derivedFieldTypes = [
    // Airtable-computed values that won't stay up to date
    "multipleLookupValues",
    "rollup",
    "formula",
    "count",

    //will not remain accurate and shouldn't be migrated'
    "lastModifiedTime",
    "lastModifiedBy",

    //doesn't make sense to want in convex
    "button",
    "externalSyncSource",
];

function sanitizeIdentifierForConvex(airtableFieldName) {
    // Identifiers can only contain alphanumeric characters or underscores
    return airtableFieldName.replaceAll(' ', '_').replace(/\W/g, '')
}

async function beginAirtableImport() {
    const BASE_ID = process.argv[2];

    if (!BASE_ID) {
        console.log("Provide your base ID (an 18 character string starting with \"app\") as an argument");
        return;
    }
    const metadataResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
        headers: new Headers({
            'Authorization': `Bearer ${process.env['AIRTABLE_API_KEY']}`
        })
    })

    const data = await metadataResponse.json();
    const tables = data['tables'];
    const jsonTables = [];

    for (const table of tables) {
        const convexTableName = sanitizeIdentifierForConvex(table['name']);
        const fields = [];
        for (const field of table['fields']) {
            if (derivedFieldTypes.includes(field['type'])) {
                console.log(`Omitting ${field['type']} field ${field['name']} from table ${table['name']} from your import.
                This field contains derived data that won't necessarily stay up to date in Convex`)
            } else {
                const convexFieldName = sanitizeIdentifierForConvex(field['name']);
                fields.push({
                    airtableFieldId: field['id'],
                    airtableFieldName: field['name'],
                    convexFieldName,
                })
            }
        }
        jsonTables.push({
            airtableTableId: table['id'],
            airtableTableName: table['name'],
            convexTableName,
            fields,
        });
    }
    await fs.promises.mkdir('./airtableData', { recursive: true })
    const filename = './airtableData/naming.json'
    const fileContents = {
        baseId: BASE_ID,
        tables: jsonTables
    }
    await fs.promises.writeFile(filename, JSON.stringify(fileContents, null, 2));
    return `Done. Edit the convexTableName & convexFieldName values in ${filename} or remove tables/fields if desired, then run \nnode ./scripts/airtableImport.js`
}

beginAirtableImport().then(console.log)