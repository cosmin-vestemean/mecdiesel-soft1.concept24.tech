import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'

export const authentication = (app) => {
  const service = new AuthenticationService(app)

  service.register('jwt', new JWTStrategy())
  app.use('authentication', service)
}