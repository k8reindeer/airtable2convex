/* eslint-disable */
/**
 * Generated API.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * Generated by convex@0.14.1.
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules } from "convex/api";
import type * as airtable_attachments from "../airtable/attachments";
import type * as airtable_link from "../airtable/link";
import type * as airtableSchema from "../airtableSchema";
import type * as lib_migrations from "../lib/migrations";
import type * as listMessages from "../listMessages";
import type * as sendMessage from "../sendMessage";

/**
 * A type describing your app's public Convex API.
 *
 * This `API` type includes information about the arguments and return
 * types of your app's query and mutation functions.
 *
 * This type should be used with type-parameterized classes like
 * `ConvexReactClient` to create app-specific types.
 */
export type API = ApiFromModules<{
  "airtable/attachments": typeof airtable_attachments;
  "airtable/link": typeof airtable_link;
  airtableSchema: typeof airtableSchema;
  "lib/migrations": typeof lib_migrations;
  listMessages: typeof listMessages;
  sendMessage: typeof sendMessage;
}>;
