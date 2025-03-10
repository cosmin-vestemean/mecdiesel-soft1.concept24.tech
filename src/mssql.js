// For more information about this file see https://dove.feathersjs.com/guides/cli/databases.html
import knex from 'knex'

export const mssql = (app) => {
  const config = app.get('mssql')
  const db = knex(config)

  app.set('mssqlClient', db)
}
