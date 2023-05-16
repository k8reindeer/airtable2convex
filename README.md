# Airtable -> Convex

The scripts and convex functions in this example convex app demonstrate a way to migrate your data from Airtable to Convex

## How to use

First set up Airtable Authentication. Create a Personal Access token [here](https://airtable.com/create/tokens).
You need scopes `data.records:read` and `schema.bases:read` for the base you want to import to Convex.

`export AIRTABLE_API_KEY=[your token]`

`node scripts/beginAirtableImport.js` 

Open `airtableData/tableNames.jsonl` and remove or rename any of your Airtable tables so you can give them a different name in Convex.

`node scripts/airtableImport.js`

This will download your Airtable data into `airtableData/tableData/` and print some `npx convex import` statements into your console. Copy and paste those directly so you don't misspell your new table names!

It also generates a schema at `convex/airtableSchema.ts` for you to import into to `convex/schema.ts`. Wait for Convex to build the indexes on your airtable tables before running

`node scripts/airtableLink.js`

This will modify your Convex database to create foreign keys to the Convex documents indicated by your linked fields in Airtable
