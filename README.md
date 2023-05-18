# Airtable -> Convex

The scripts and convex functions in this example convex app demonstrate a way to
migrate your data from Airtable to a [Convex](convex.dev) project.

## How to use

### Set up your repo

If you want to use this repo, set up your project:
```
npm i
npx convex init
```

If you want to import the data into your own repo, copy over:
- [scripts directory](./scripts/)
- [convex/lib/migrations.ts](./convex/lib/migrations.ts)
- [convex/linkAirtableImports.ts](./convex/linkAirtableImports.ts)
- [convex/storeAirtableAttachment.ts](./convex/storeAirtableAttachment.ts)

And install some dependencies: `npm i convex airtable dotenv`

If your project doesn't use convex yet: `npx convex init`


### Export from Airtable

First, set up Airtable Authentication. Create a Personal Access token [here](https://airtable.com/create/tokens).
You need scopes `data.records:read` and `schema.bases:read` for the base you want to import to Convex.

`export AIRTABLE_API_KEY=[your-token]`

Grab the base ID from airtable (find it in the URL of your base -- an 18 character string starting with "app")

`node scripts/beginAirtableImport.js [your-base-id]`

If you get `ReferenceError: fetch is not defined`, update `node` to version 18.
`fetch` isn't included in `node` version < 18.
Don't worry, you can use node 18 to run the import scripts without updating your project otherwise.

Tip: you can use `nvm` to easily switch between node versions.

### Configure name mapping

Open `airtableData/naming.json` and remove or rename any of your Airtable tables so you can give them a different name in Convex.

### Import into Convex

`node scripts/airtableImport.js`

This will download your Airtable data into `airtableData/tableData/` and print some `npx convex import` statements into your console. Copy and paste those directly so you don't misspell your new table names!

### Re-link fields

The import script also generated a schema at `convex/airtableSchema.ts` for you to import into to `convex/schema.ts`.
This repo already has it imported, but if you're extending your existing repo,
you'll need to add `...airtableSchemas,` to your schema definition.
See [convex/schema.ts](./convex/schema.ts) as an example.
It may include some fields named after the airtable IDs - keep those there until
after this step, as they're important for linking documents together.
To sync the schema and functions, run `npx convex dev --once` or, for prod, `npx convex deploy`.
Once Convex syncs the schema and indexes, you can link the table references with:

```
export CONVEX_URL="<value from .env for prod or .env.local for dev>";
node scripts/airtableLink.js
```

This will modify your Convex database to create foreign keys to the Convex
documents indicated by your linked fields in Airtable.

### Save attachment files

If you included Airtable attachment fields in your import, the links provided by Airtable
will [expire](https://support.airtable.com/docs/airtable-attachment-url-behavior) after 2 hours.
To save those attachments in Convex using [file storage](https://docs.convex.dev/file-storage) use:

`node scripts/storeAirtableAttachments.js`

which removes the expiring urls, stores the file in Convex and adds the storage id to the document.

### Cleanup

You can now delete the fields and indexes named for the airtable IDs from your schema.
You can also delete the "scripts/" folder and "convex/linkAirtableImports.ts".

You can further modify your schema and run
[migrations](https://stack.convex.dev/migrating-data-with-mutations)
to change any relationships.
