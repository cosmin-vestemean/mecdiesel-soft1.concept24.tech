export const siteProductChangesHistoryPath = 'site_product_changes_history'

export const siteProductChangesHistoryMethods = ['find', 'get', 'create', 'patch', 'remove']

export const siteProductChangesHistoryClient = (client) => {
  const connection = client.get('connection')

  client.use(siteProductChangesHistoryPath, connection.service(siteProductChangesHistoryPath), {
    methods: siteProductChangesHistoryMethods
  })
}
