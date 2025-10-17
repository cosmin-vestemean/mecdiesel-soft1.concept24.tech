// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import { Type, getValidator, querySyntax } from "@feathersjs/typebox";
import { dataValidator, queryValidator } from "../../validators.js";

// Main data model schema
export const mecItemSchema = Type.Object(
  {
    Item_key: Type.String(),
    Company_ID: Type.String(),
    Item: Type.String(),
    Item_status: Type.String(),
    Item_description: Type.String(),
    Item_brand: Type.String(),
    Item_box: Type.String(),
    Item_kind: Type.Number(),
    User_code: Type.String(),
    Insert_date: Type.Optional(Type.String()),
    Modify_date: Type.Optional(Type.String()),
    Delete_date: Type.Optional(Type.String()),
    Item_outlet: Type.Optional(Type.Number()),
  },
  { $id: "MecItem", additionalProperties: false }
);
export const mecItemValidator = getValidator(mecItemSchema, dataValidator);
export const mecItemResolver = resolve({});

export const mecItemExternalResolver = resolve({});

// Schema for creating new entries
export const mecItemDataSchema = Type.Pick(
  mecItemSchema,
  [
    "Item_key",
    "Company_ID",
    "Item",
    "Item_status",
    "Item_description",
    "Item_brand",
    "Item_box",
    "Item_kind",
    "User_code",
    "Delete_date",
    "Item_outlet",
  ],
  {
    $id: "MecItemData",
  }
);
export const mecItemDataValidator = getValidator(
  mecItemDataSchema,
  dataValidator
);
export const mecItemDataResolver = resolve({});

// Schema for updating existing entries
export const mecItemPatchSchema = Type.Partial(mecItemSchema, {
  $id: "MecItemPatch",
});
export const mecItemPatchValidator = getValidator(
  mecItemPatchSchema,
  dataValidator
);
export const mecItemPatchResolver = resolve({});

// Schema for allowed query properties
export const mecItemQueryProperties = Type.Pick(mecItemSchema, [
  "Item_key",
  "Company_ID",
  "Item",
  "Item_status",
  "Item_description",
  "Item_brand",
  "Item_box",
  "Item_kind",
  "User_code",
  "Delete_date",
  "Item_outlet",
]);
export const mecItemQuerySchema = Type.Intersect(
  [
    querySyntax(mecItemQueryProperties),
    // Add additional query properties here
    Type.Object(
      {
        //add Modify_date to query and sort by it descending
        $sort: Type.Object({
          Modify_date: Type.String(),
        }),
        Item: Type.Optional(Type.String()),
        Item_key: Type.Optional(Type.String()),
        Item_outlet: Type.Optional(Type.Number()),
      },
      { additionalProperties: false }
    ),
  ],
  { additionalProperties: false }
);
export const mecItemQueryValidator = getValidator(
  mecItemQuerySchema,
  queryValidator
);
export const mecItemQueryResolver = resolve({});
