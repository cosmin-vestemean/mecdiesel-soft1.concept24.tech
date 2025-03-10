// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { dataValidator, queryValidator } from '../../validators.js'

// Main data model schema
export const mecItemAltrefSchema = Type.Object(
  {
    key: Type.String(),
    Item: Type.String(),
    Altref: Type.String(),
    Company_ID: Type.String(),
    Item_key: Type.String(),
  },
  { $id: 'MecItemAltref', additionalProperties: false }
)
export const mecItemAltrefValidator = getValidator(mecItemAltrefSchema, dataValidator)
export const mecItemAltrefResolver = resolve({})

export const mecItemAltrefExternalResolver = resolve({})

// Schema for creating new entries
export const mecItemAltrefDataSchema = Type.Pick(mecItemAltrefSchema, ['key', 'Item', 'Altref', 'Company_ID', 'Item_key'], {
  $id: 'MecItemAltrefData'
})
export const mecItemAltrefDataValidator = getValidator(mecItemAltrefDataSchema, dataValidator)
export const mecItemAltrefDataResolver = resolve({})

// Schema for updating existing entries
export const mecItemAltrefPatchSchema = Type.Partial(mecItemAltrefSchema, {
  $id: 'MecItemAltrefPatch'
})
export const mecItemAltrefPatchValidator = getValidator(mecItemAltrefPatchSchema, dataValidator)
export const mecItemAltrefPatchResolver = resolve({})

// Schema for allowed query properties
export const mecItemAltrefQueryProperties = Type.Pick(mecItemAltrefSchema, ['key', 'Item', 'Altref', 'Company_ID', 'Item_key'], {
  $id: 'MecItemAltrefQuery'
})
export const mecItemAltrefQuerySchema = Type.Intersect(
  [
    querySyntax(mecItemAltrefQueryProperties),
    // Add additional query properties here
    Type.Object({
      Item: Type.String(),
      Altref: Type.String(),
      Company_ID: Type.String(),
      Item_key: Type.String(),
    }, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export const mecItemAltrefQueryValidator = getValidator(mecItemAltrefQuerySchema, queryValidator)
export const mecItemAltrefQueryResolver = resolve({})
