// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { dataValidator, queryValidator } from '../../validators.js'

// Main data model schema
export const mecRoItemRelSupplierSchema = Type.Object(
  {
    id: Type.Number(),
    erp_id: Type.Optional(Type.Number()),
    mec_code: Type.String(),
    supplier_code: Type.Optional(Type.String()),
    created_at: Type.Optional(Type.String()),
    updated_at: Type.Optional(Type.String())
  },
  { $id: 'MecRoItemRelSupplier', additionalProperties: false }
)
export const mecRoItemRelSupplierValidator = getValidator(mecRoItemRelSupplierSchema, dataValidator)
export const mecRoItemRelSupplierResolver = resolve({})

export const mecRoItemRelSupplierExternalResolver = resolve({})

// Schema for creating new entries
export const mecRoItemRelSupplierDataSchema = Type.Pick(mecRoItemRelSupplierSchema, ['erp_id', 'mec_code', 'supplier_code'], {
  $id: 'MecRoItemRelSupplierData'
})
export const mecRoItemRelSupplierDataValidator = getValidator(mecRoItemRelSupplierDataSchema, dataValidator)
export const mecRoItemRelSupplierDataResolver = resolve({})

// Schema for updating existing entries
export const mecRoItemRelSupplierPatchSchema = Type.Partial(mecRoItemRelSupplierSchema, {
  $id: 'MecRoItemRelSupplierPatch'
})
export const mecRoItemRelSupplierPatchValidator = getValidator(mecRoItemRelSupplierPatchSchema, dataValidator)
export const mecRoItemRelSupplierPatchResolver = resolve({})

// Schema for allowed query properties
export const mecRoItemRelSupplierQueryProperties = Type.Pick(mecRoItemRelSupplierSchema, ['id', 'erp_id', 'mec_code', 'supplier_code', 'created_at', 'updated_at'])
export const mecRoItemRelSupplierQuerySchema = Type.Intersect(
  [
    querySyntax(mecRoItemRelSupplierQueryProperties),
    // Add additional query properties here
    Type.Object({
      mec_code: Type.String(),
      supplier_code: Type.String()
    }, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export const mecRoItemRelSupplierQueryValidator = getValidator(
  mecRoItemRelSupplierQuerySchema,
  queryValidator
)
export const mecRoItemRelSupplierQueryResolver = resolve({})
