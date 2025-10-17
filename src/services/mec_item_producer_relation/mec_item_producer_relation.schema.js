// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import { Type, getValidator, querySyntax } from "@feathersjs/typebox";
import { dataValidator, queryValidator } from "../../validators.js";

// Main data model schema
export const mecItemProducerRelationSchema = Type.Object(
  {
    Company_ID: Type.String(),
    Item: Type.String(),
    Producer_ID: Type.String(),
    Producer_Item: Type.String(),
    Producer_Item_comp: Type.String(),
    User_code: Type.String(),
    Key: Type.String(),
    Item_key: Type.String(),
    Producer_Item_key: Type.String(),
    Insert_date: Type.Optional(Type.String()),
    Modify_date: Type.Optional(Type.String()),
    Delete_date: Type.Optional(Type.String())
  },
  { $id: "MecItemProducerRelation", additionalProperties: false }
);
export const mecItemProducerRelationValidator = getValidator(
  mecItemProducerRelationSchema,
  dataValidator
);
export const mecItemProducerRelationResolver = resolve({});

export const mecItemProducerRelationExternalResolver = resolve({});

// Schema for creating new entries
export const mecItemProducerRelationDataSchema = Type.Pick(
  mecItemProducerRelationSchema,
  [
    "Company_ID",
    "Producer_ID",
    "Producer_Item",
    "Producer_Item_comp",
    "User_code",
    "Key",
    "Item_key",
    "Producer_Item_key",
    "Item",
    "Delete_date"
  ],
  {
    $id: "MecItemProducerRelationData",
  }
);
export const mecItemProducerRelationDataValidator = getValidator(
  mecItemProducerRelationDataSchema,
  dataValidator
);
export const mecItemProducerRelationDataResolver = resolve({});

// Schema for updating existing entries
export const mecItemProducerRelationPatchSchema = Type.Partial(
  mecItemProducerRelationSchema,
  {
    $id: "MecItemProducerRelationPatch",
  }
);
export const mecItemProducerRelationPatchValidator = getValidator(
  mecItemProducerRelationPatchSchema,
  dataValidator
);
export const mecItemProducerRelationPatchResolver = resolve({});

// Schema for allowed query properties
export const mecItemProducerRelationQueryProperties = Type.Pick(
  mecItemProducerRelationSchema,
  [
    "Company_ID",
    "Producer_ID",
    "Producer_Item",
    "Producer_Item_comp",
    "User_code",
    "Key",
    "Item_key",
    "Producer_Item_key",
    "Item",
    "Delete_date"
  ]
);
export const mecItemProducerRelationQuerySchema = Type.Intersect(
  [
    querySyntax(mecItemProducerRelationQueryProperties),
    // Add additional query properties here
    Type.Object(
      {
        //add Modify_date to query and sort by it descending
        $sort: Type.Object({
          Modify_date: Type.String(),
        }),
        Item: Type.Optional(Type.String()),
      },
      { additionalProperties: false }
    ),
  ],
  { additionalProperties: false }
);
export const mecItemProducerRelationQueryValidator = getValidator(
  mecItemProducerRelationQuerySchema,
  queryValidator
);
export const mecItemProducerRelationQueryResolver = resolve({});
