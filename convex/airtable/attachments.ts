import {Doc, Id, TableNames } from "../_generated/dataModel";
import {action, internalMutation, internalQuery, query} from "../_generated/server";

type AttachmentSpecifier<T extends TableNames> = {docId: Id<T>, fieldName: keyof Doc<T>}
type AttachmentSpecAndValue<T extends TableNames, F extends keyof Doc<T>> = {docId: Id<T>, fieldName: F, newValue: Doc<T>[F]}

export const store = action(async ({ runMutation, runQuery, storage }, { docId, fieldName }: AttachmentSpecifier<TableNames>) => {
  const fieldValue = await runQuery("airtable/attachments:read", {docId, fieldName}) as Doc<TableNames>[typeof fieldName];

  if (fieldValue && Array.isArray(fieldValue)) {
    for (const attachment of fieldValue) {
      // Fetch all attachments for a given record in a single action. If any of them fail, we won't
      // do the mutation to update the storage IDs at the end
      const expiringAirtableUrl = attachment['url']
      if (!expiringAirtableUrl) {
        console.log(`Expiring URL already removed, skipping this attachment`)
        continue;
      }
      // Download the attachment
      const fileResponse = await fetch(expiringAirtableUrl);
      if (!fileResponse.ok) {
        throw new Error(`failed to download: ${fileResponse.statusText}`);
      }

      // Store the attachment to Convex storage.
      const file = await fileResponse.blob();
      attachment['storageId'] = await storage.store(file);
      delete attachment['url']
      delete attachment['thumbnails']
    }
    console.log(`Fetched ${fieldValue.length} attachments for ${docId}`);
  }

  await runMutation("airtable/attachments:update", {docId, fieldName, newValue: fieldValue});

});



export const read = internalQuery(async ({ db }, { docId, fieldName }: AttachmentSpecifier<TableNames>) => {
  const doc = await db.get(docId);
  if (!doc) {throw new Error(`document not found ${docId}`) }
  return doc[fieldName]
});

export const update = internalMutation( async ({db}, {docId, fieldName, newValue}: AttachmentSpecAndValue<TableNames, keyof Doc<TableNames>> ) => {
  await db.patch(docId, {[fieldName]: newValue ?? undefined})
})

type ListArgs<T extends TableNames> = {
  table: T;
  fieldName: keyof Doc<T>;
  cursor: string;
  numItems: number;
}

export const listSingly = query(async ({db}, {table, fieldName, cursor}: ListArgs<TableNames>) => {
  const data =  await db.query(table).filter(q => q.neq(q.field(fieldName), null)).paginate({cursor, numItems: 1});
  const { page, isDone, continueCursor } = data;
  const docId = page[0]?._id;
  if (isDone) {
    console.log(`Done listing table ${table}`);
  }
  return {isDone, cursor: continueCursor, docId}
})
