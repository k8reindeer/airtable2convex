const { ConvexHttpClient } = require("convex/browser");
const fs = require('fs');
require("dotenv").config({ path: ".env.local" });


async function storeAirtableImages() {
    const client = new ConvexHttpClient(process.env["CONVEX_URL"]);
    // TODO store this list in a file in airtableImport and read it here
    const imageTableAndFields = [{table: "All_Field_Types", fieldName: "Attachment"}]
    for (const {table, fieldName} of imageTableAndFields) {
        // paginated query over the table, filter for whether the field is set.
        // and for each, call the action storeAirtableImages on the docId an fielName


    }
}

storeAirtableImages();