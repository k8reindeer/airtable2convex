const { ConvexHttpClient } = require("convex/browser");
const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

const numItems = 100;
async function airtableLink() {
    const client = new ConvexHttpClient(process.env["CONVEX_URL"]);
    const linkedFieldsFilename = './airtableData/linkedFields.json';
    const linkedFieldsByTableName = JSON.parse((await fs.promises.readFile(linkedFieldsFilename)).toString());

    for (const table of Object.keys(linkedFieldsByTableName)) {
        for (const migrationCtx of linkedFieldsByTableName[table]) {
            // Run the batches in a loop
            let isDone = false;
            let cursor = null;
            let total = 0;
            console.log(`Linking up ${migrationCtx['convexIdField']} in table ${table}`)
            while (!isDone) {
                const result = await client.mutation("airtable/link", {table, migrationCtx, cursor, numItems});
                total += result.count;
                ({ isDone, cursor } = result);
            }
            console.log(`Done linking ${total} records`);
        }
        console.log(`Done linking all ${linkedFieldsByTableName[table].length} fields in ${table}`)
    }

    // TODO give this script the option remove the airtableId field from each table (or you know keep it for posterity)

}

airtableLink().then(console.log)