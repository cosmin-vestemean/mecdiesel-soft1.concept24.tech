// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import { Type, getValidator, querySyntax } from "@feathersjs/typebox";
import { dataValidator, queryValidator } from "../../validators.js";

// Main data model schema
export const siteProductChangesHistorySchema = Type.Object(
  {
    id: Type.Number(),
    item_key: Type.String({ maxLength: 27 }),
    mec_code: Type.String({ maxLength: 25 }),
    is_processed: Type.Number(),
    created_at: Type.Optional(Type.String()),
    updated_at: Type.Optional(Type.String()),
  },
  { $id: "SiteProductChangesHistory", additionalProperties: false }
);
export const siteProductChangesHistoryValidator = getValidator(
  siteProductChangesHistorySchema,
  dataValidator
);
export const siteProductChangesHistoryResolver = resolve({});

export const siteProductChangesHistoryExternalResolver = resolve({});

// Schema for creating new entries
export const siteProductChangesHistoryDataSchema = Type.Pick(
  siteProductChangesHistorySchema,
  ["item_key", "mec_code", "is_processed", "created_at", "updated_at"],
  {
    $id: "SiteProductChangesHistoryData",
  }
);
export const siteProductChangesHistoryDataValidator = getValidator(
  siteProductChangesHistoryDataSchema,
  dataValidator
);
export const siteProductChangesHistoryDataResolver = resolve({});

// Schema for updating existing entries
export const siteProductChangesHistoryPatchSchema = Type.Partial(
  siteProductChangesHistorySchema,
  {
    $id: "SiteProductChangesHistoryPatch",
  }
);
export const siteProductChangesHistoryPatchValidator = getValidator(
  siteProductChangesHistoryPatchSchema,
  dataValidator
);
export const siteProductChangesHistoryPatchResolver = resolve({});

// Schema for allowed query properties
export const siteProductChangesHistoryQueryProperties = Type.Pick(
  siteProductChangesHistorySchema,
  ["id", "item_key", "mec_code", "is_processed", "created_at", "updated_at"]
);
export const siteProductChangesHistoryQuerySchema = Type.Intersect(
  [
    querySyntax(siteProductChangesHistoryQueryProperties),
    // Add additional query properties here
    //add item_key to query
    Type.Object({
      item_key: Type.String({ maxLength: 27 }),
      id: Type.Optional(Type.Number()),
    }, { additionalProperties: false }),
  ],
  { additionalProperties: false }
);
export const siteProductChangesHistoryQueryValidator = getValidator(
  siteProductChangesHistoryQuerySchema,
  queryValidator
);
export const siteProductChangesHistoryQueryResolver = resolve({});
