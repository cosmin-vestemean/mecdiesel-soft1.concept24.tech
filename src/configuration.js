import { Type, getValidator, defaultAppConfiguration } from '@feathersjs/typebox'

import { dataValidator } from './validators.js'

const authenticationConfiguration = Type.Object({
  secret: Type.String(),
  entity: Type.Union([Type.String(), Type.Null()]),
  authStrategies: Type.Array(Type.String()),
  jwtOptions: Type.Optional(Type.Object({}))
})

export const configurationSchema = Type.Intersect([
  Type.Omit(defaultAppConfiguration, ['authentication']),
  Type.Object({
    host: Type.String(),
    port: Type.Number(),
    public: Type.String(),
    authentication: authenticationConfiguration
  })
])

export const configurationValidator = getValidator(configurationSchema, dataValidator)
