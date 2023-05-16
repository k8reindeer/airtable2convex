import { defineSchema, defineTable } from "convex/schema";
import { v } from "convex/values";
import airtableSchemas from "./airtableSchema";

export default defineSchema({
  ...airtableSchemas,
    messages: defineTable({ author: v.string(), body: v.string() , airtableId: v.optional(v.string())})
    // HAX dangit how do we get this to work with existing tables in your project??
    .index("by_airtable_id", ["airtableId"]),


  }, {schemaValidation: false});