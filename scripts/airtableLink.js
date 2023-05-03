const { ConvexHttpClient } = require("convex/browser");
require("dotenv").config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env["CONVEX_URL"]);
// TODO temporarily hard-coded! in the future, save this json to a file and reload it here
const linkedFields = [
    {
        tableName: 'Dresses',
        fieldId: 'fldz5Jrr1bhzGGWob',
        fieldName: 'Table_3',
        targetTableName: 'Alphabet_groups'
    },
    {
        tableName: 'Alphabet_groups',
        fieldId: 'flddNi3fWyxOoeV9l',
        fieldName: 'Dresses',
        targetTableName: 'Dresses'
    }
]

//TODO scale test this and determine if we need to batch calls to linkAirtableImports (and thus lose atomicity)
// ...which will probably enable retries / idempotency

client.mutation("linkAirtableImports", {linkedFields}).then(console.log);
