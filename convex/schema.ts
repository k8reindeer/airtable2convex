import { defineSchema, defineTable } from "convex/schema";
import { v } from "convex/values";

export default defineSchema({
  Alphabet_groups: defineTable({
    Dress_IDfromDresses: v.optional(v.array(v.string())),
    Dresses: v.optional(v.array(v.id('Dresses'))),
    Name: v.string(),
    airtableId: v.string(),
  })
    .index("by_airtable_id", ["airtableId"]),
  Dresses: defineTable({
    Chiffon: v.optional(v.boolean()),
    Disqualified_Reason: v.optional(v.string()),
    Dress_ID: v.string(),
    Dress_Name: v.string(),
    Final_Decision: v.optional(v.string()),
    Floor_Length: v.optional(v.boolean()),
    Has_Slit: v.optional(v.boolean()),
    Image_back: v.array(
      v.object({
        filename: v.string(),
        height: v.number(),
        id: v.string(),
        size: v.number(),
        thumbnails: v.object({
          full: v.object({
            height: v.number(),
            url: v.string(),
            width: v.number(),
          }),
          large: v.object({
            height: v.number(),
            url: v.string(),
            width: v.number(),
          }),
          small: v.object({
            height: v.number(),
            url: v.string(),
            width: v.number(),
          }),
        }),
        type: v.string(),
        url: v.string(),
        width: v.number(),
      })
    ),
    Image_front: v.array(
      v.object({
        filename: v.string(),
        height: v.number(),
        id: v.string(),
        size: v.number(),
        thumbnails: v.object({
          full: v.object({
            height: v.number(),
            url: v.string(),
            width: v.number(),
          }),
          large: v.object({
            height: v.number(),
            url: v.string(),
            width: v.number(),
          }),
          small: v.object({
            height: v.number(),
            url: v.string(),
            width: v.number(),
          }),
        }),
        type: v.string(),
        url: v.string(),
        width: v.number(),
      })
    ),
    Jordan_Comments: v.optional(v.string()),
    Kate_Comments: v.optional(v.string()),
    Katy_Comments: v.optional(v.string()),
    Lucy_Comments: v.optional(v.string()),
    Price: v.number(),
    Table_3: v.array(v.string()),
    URL: v.string(),
    airtableId: v.string(),
  })
    .index("by_airtable_id", ["airtableId"]),
  messages: defineTable({ author: v.string(), body: v.string() , airtableId: v.optional(v.string())})
    // HAX
    .index("by_airtable_id", ["airtableId"]),
});