import { defineSchema, defineTable } from "convex/schema";
import { v } from "convex/values";
import airtableSchemas from "./airtableSchema";

export default defineSchema({
  ...airtableSchemas,
    messages: defineTable({ author: v.string(), body: v.string() })
  }, {schemaValidation: false});