export const siteProductFrequentChangesPath = 'site_product_frequent_changes'

export const siteProductFrequentChangesMethods = ['find', 'get', 'create', 'patch', 'remove']

export const siteProductFrequentChangesClient = (client) => {
  const connection = client.get('connection')

  client.use(siteProductFrequentChangesPath, connection.service(siteProductFrequentChangesPath), {
    methods: siteProductFrequentChangesMethods
  })
}
