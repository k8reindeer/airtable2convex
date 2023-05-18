const { ConvexHttpClient } = require("convex/browser");
const fs = require('fs');
require("dotenv").config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env["CONVEX_URL"]);

async function storeAirtableAttachments(table, fieldName) {
    let isDone = false;
    let cursor = null;
    let total = 0;
    while (!isDone) {
        // paginated query over the table, filtered for whether the field is set.
        const result = await client.query("storeAirtableAttachment:listSingly", {table, fieldName, cursor});
        const {docId} = result;
        if (docId) {
            await client.action("storeAirtableAttachment", {docId, fieldName});
            total += 1;
        }
        ({isDone, cursor} = result);
    }
    console.log(`Done storing all attachments for ${total} records in ${table}`);

}

async function storeAllAirtableAttachments() {
    const attachmentFieldsFilename = './airtableData/attachmentFields.json';
    const attachmentFields = JSON.parse((await fs.promises.readFile(attachmentFieldsFilename)).toString());

    for (const {table, field: fieldName} of attachmentFields) {
        await storeAirtableAttachments(table, fieldName);
    }
}

storeAllAirtableAttachments();