const { ConvexHttpClient } = require("convex/browser");
const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

//TODO scale test this and determine if we need to batch calls to linkAirtableImports (and thus lose atomicity)
// ...which will probably enable retries / idempotency
async function airtableLink() {
    const client = new ConvexHttpClient(process.env["CONVEX_URL"]);
    const linkedFieldsFilename = './airtableData/linkedFields.json';
    const linkedFields = JSON.parse((await fs.promises.readFile(linkedFieldsFilename)).toString());

    client.mutation("linkAirtableImports", {linkedFields}).then(console.log);
}

airtableLink().then(console.log)