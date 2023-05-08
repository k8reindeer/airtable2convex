const { ConvexHttpClient } = require("convex/browser");
const fs = require('fs');
require("dotenv").config({ path: ".env.local" });


async function airtableLink() {
    const client = new ConvexHttpClient(process.env["CONVEX_URL"]);
    const linkedFieldsFilename = './airtableData/linkedFields.json';
    const linkedFields = JSON.parse((await fs.promises.readFile(linkedFieldsFilename)).toString());

    //TODO scale test this and determine if we need to batch calls to linkAirtableImports (and thus lose atomicity)
    // ...which will probably enable retries / idempotency
    client.mutation("linkAirtableImports", {linkedFields}).then(console.log);

    // TODO give this script the option remove the airtableId field from each table (or you know keep it for posterity)

}

airtableLink().then(console.log)