const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

const BASE_ID = 'appXw3Dbn5Sd6G7mp'

async function beginAirtableImport() {
    const metadataResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
        headers: new Headers({
            'Authorization': `Bearer ${process.env['AIRTABLE_API_KEY']}`
        })
    })

    const data = await metadataResponse.json();
    const tables = data['tables'];
    const jsonlTables = [];

    for (const table of tables) {
        const convexTableName = table['name'].replace(' ', '_').replace(/\W/g, '');
        jsonlTables.push(JSON.stringify({
            airtableTableId: table['id'],
            airtableTableName: table['name'],
            convexTableName
        }));
    }
    await fs.promises.mkdir('./airtableData', { recursive: true })
    const filename = './airtableData/tableNames.jsonl'
    await fs.promises.writeFile(filename, jsonlTables.join('\n'));
    return `Done. Edit the table names in ${filename} or remove tables to omit if desired, then run \nnode ./scripts/airtableImport.js`
}

beginAirtableImport().then(console.log)