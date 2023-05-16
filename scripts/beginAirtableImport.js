const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

// TODO add command line argument to include these anyways
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
];

function sanitizeIdentifierForConvex(airtableFieldName) {
    // Identifiers can only contain alphanumeric characters or underscores
    return airtableFieldName.replaceAll(' ', '_').replace(/\W/g, '')
}

async function beginAirtableImport() {
    const BASE_ID = process.argv[2];
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
            if (!derivedFieldTypes.includes(field['type'])) {
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