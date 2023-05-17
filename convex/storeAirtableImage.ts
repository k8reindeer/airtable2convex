import {Doc, Id, TableNames } from "./_generated/dataModel";
import {action, internalMutation, internalQuery} from "./_generated/server";

type ImageSpecifier<T extends TableNames> = {docId: Id<T>, imageFieldName: keyof Doc<T>}
type ImageSpecAndValue<T extends TableNames, F extends keyof Doc<T>> = {docId: Id<T>, imageFieldName: F, newValue: Doc<T>[F]}

export default action(async ({ runMutation, runQuery, storage }, { docId, imageFieldName }: ImageSpecifier<TableNames>) => {
  const imageFieldValue = await runQuery("storeAirtableImage:read", {docId, imageFieldName}) as Doc<TableNames>[typeof imageFieldName];

  if (imageFieldValue && Array.isArray(imageFieldValue)) {
    for (const attachment of imageFieldValue) {
      // Fetch all attachments for a given record in a single action. If any of them fail, we won't
      // do the mutation to update the storage IDs at the end
      const expiringAirtableUrl = attachment['url']
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
  }

  await runMutation("storeAirtableImage:update", {docId, imageFieldName, newValue: imageFieldValue});

});



export const read = internalQuery(async ({ db }, { docId, imageFieldName }: ImageSpecifier<TableNames>) => {
  const doc = await db.get(docId);
  if (!doc) {throw new Error(`document not found ${docId}`) }
  return doc[imageFieldName]
});

export const update = internalMutation( async ({db}, {docId, imageFieldName, newValue}: ImageSpecAndValue<TableNames, keyof Doc<TableNames>> ) => {
  await db.patch(docId, {[imageFieldName]: newValue})
})
