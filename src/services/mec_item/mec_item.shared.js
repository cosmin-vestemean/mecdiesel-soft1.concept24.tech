export const mecItemPath = 'mec_item'

export const mecItemMethods = ['find', 'get', 'create', 'patch', 'remove']

export const mecItemClient = (client) => {
  const connection = client.get('connection')

  client.use(mecItemPath, connection.service(mecItemPath), {
    methods: mecItemMethods
  })
}
