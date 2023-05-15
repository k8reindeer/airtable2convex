# Airtable -> Convex

The scripts and convex functions in this example convex app demonstrate a way to migrate your data from Airtable to Convex

## How to use

`node scripts/beginAirtableImport.js` 

Open `airtableData/tableNames.jsonl` and remove or rename any of your Airtable tables so you can give them a different name in Convex.

`node scripts/airtableImport.js`

This will download your Airtable data into `airtableData/tableData/` and print some `npx convex import` statements into your console. Copy and paste those directly so you don't misspell your new table names!

It also generates a schema at `convex/airtableSchema.ts` for you to incorporate into to `convex/schema.ts`. Merge it with any existing tables manually, then wait for Convex to build the indexes before running

`node scripts/airtableLink.js`

This will modify your Convex database to create foreign keys to the Convex documents indicated by your linked fields in Airtable
