import {Doc, Id, TableNames } from "./_generated/dataModel";
import {action, internalMutation, internalQuery, query} from "./_generated/server";

type ImageSpecifier<T extends TableNames> = {docId: Id<T>, fieldName: keyof Doc<T>}
type ImageSpecAndValue<T extends TableNames, F extends keyof Doc<T>> = {docId: Id<T>, fieldName: F, newValue: Doc<T>[F]}

export default action(async ({ runMutation, runQuery, storage }, { docId, fieldName }: ImageSpecifier<TableNames>) => {
  const imageFieldValue = await runQuery("storeAirtableImage:read", {docId, fieldName}) as Doc<TableNames>[typeof fieldName];

  if (imageFieldValue && Array.isArray(imageFieldValue)) {
    for (const attachment of imageFieldValue) {
      // Fetch all attachments for a given record in a single action. If any of them fail, we won't
      // do the mutation to update the storage IDs at the end
      const expiringAirtableUrl = attachment['url']
      if (!expiringAirtableUrl) {
        console.log(`Expiring URL already removed, skipping this attachment`)
        continue;
      }
      // Download the image
      const imageResponse = await fetch(expiringAirtableUrl);
      if (!imageResponse.ok) {
        throw new Error(`failed to download: ${imageResponse.statusText}`);
      }

      // Store the image to Convex storage.
      const image = await imageResponse.blob();
      attachment['storageId'] = await storage.store(image);
      // TODO perhaps we want to delete the expiring airtable urls in a separate step?
      delete attachment['url']
      delete attachment['thumbnails']

    }
    console.log(`Fetched ${imageFieldValue.length} images for ${docId}`);
  }

  await runMutation("storeAirtableImage:update", {docId, fieldName, newValue: imageFieldValue});

});



export const read = internalQuery(async ({ db }, { docId, fieldName }: ImageSpecifier<TableNames>) => {
  const doc = await db.get(docId);
  if (!doc) {throw new Error(`document not found ${docId}`) }
  return doc[fieldName]
});

export const update = internalMutation( async ({db}, {docId, fieldName, newValue}: ImageSpecAndValue<TableNames, keyof Doc<TableNames>> ) => {
  await db.patch(docId, {[fieldName]: newValue})
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
