const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

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
        const convexTableName = table['name'].replaceAll(' ', '_').replace(/\W/g, '');
        jsonTables.push({
            airtableTableId: table['id'],
            airtableTableName: table['name'],
            convexTableName
        });
    }
    await fs.promises.mkdir('./airtableData', { recursive: true })
    const filename = './airtableData/tableNames.json'
    const fileContents = {
        baseId: BASE_ID,
        tables: jsonTables
    }
    await fs.promises.writeFile(filename, JSON.stringify(fileContents, null, 2));
    return `Done. Edit the table names in ${filename} or remove tables to omit if desired, then run \nnode ./scripts/airtableImport.js`
}

beginAirtableImport().then(console.log)