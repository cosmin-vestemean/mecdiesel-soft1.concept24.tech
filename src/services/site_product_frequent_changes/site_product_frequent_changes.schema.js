// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import { Type, getValidator, querySyntax } from "@feathersjs/typebox";
import { dataValidator, queryValidator } from "../../validators.js";

// Main data model schema
export const siteProductFrequentChangesSchema = Type.Object(
  {
    id: Type.Number(),
    item_key: Type.String({ maxLength: 27 }),
    mec_code: Type.String({ maxLength: 25 }),
    is_processed: Type.Number(),
    is_available: Type.Number(),
    created_at: Type.Optional(Type.String()),
    updated_at: Type.Optional(Type.String()),
    company_id: Type.Optional(Type.Number()),
    change_type: Type.Optional(Type.String()),
  },
  { $id: "SiteProductFrequentChanges", additionalProperties: false }
);
export const siteProductFrequentChangesValidator = getValidator(
  siteProductFrequentChangesSchema,
  dataValidator
);
export const siteProductFrequentChangesResolver = resolve({});

export const siteProductFrequentChangesExternalResolver = resolve({});

// Schema for creating new entries
export const siteProductFrequentChangesDataSchema = Type.Pick(
  siteProductFrequentChangesSchema,
  [
    "item_key",
    "mec_code",
    "is_processed",
    "is_available",
    "created_at",
    "updated_at",
    "company_id",
    "change_type",
  ],
  {
    $id: "SiteProductFrequentChangesData",
  }
);
export const siteProductFrequentChangesDataValidator = getValidator(
  siteProductFrequentChangesDataSchema,
  dataValidator
);
export const siteProductFrequentChangesDataResolver = resolve({});

// Schema for updating existing entries
export const siteProductFrequentChangesPatchSchema = Type.Partial(
  siteProductFrequentChangesSchema,
  {
    $id: "SiteProductFrequentChangesPatch",
  }
);
export const siteProductFrequentChangesPatchValidator = getValidator(
  siteProductFrequentChangesPatchSchema,
  dataValidator
);
export const siteProductFrequentChangesPatchResolver = resolve({});

// Schema for allowed query properties
export const siteProductFrequentChangesQueryProperties = Type.Pick(
  siteProductFrequentChangesSchema,
  [
    "id",
    "item_key",
    "mec_code",
    "is_processed",
    "is_available",
    "created_at",
    "updated_at",
    "company_id",
    "change_type",
  ]
);
export const siteProductFrequentChangesQuerySchema = Type.Intersect(
  [
    querySyntax(siteProductFrequentChangesQueryProperties),
    // Add additional query properties here
    //add item_key to query
    Type.Object(
      {
        item_key: Type.String({ maxLength: 27 }),
      },
      { additionalProperties: false }
    ),
  ],
  { additionalProperties: false }
);
export const siteProductFrequentChangesQueryValidator = getValidator(
  siteProductFrequentChangesQuerySchema,
  queryValidator
);
export const siteProductFrequentChangesQueryResolver = resolve({});
