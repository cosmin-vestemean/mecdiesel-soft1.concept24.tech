export const mecItemAltrefPath = 'mec_item_altref'

export const mecItemAltrefMethods = ['find', 'get', 'create', 'patch', 'remove']

export const mecItemAltrefClient = (client) => {
  const connection = client.get('connection')

  client.use(mecItemAltrefPath, connection.service(mecItemAltrefPath), {
    methods: mecItemAltrefMethods
  })
}
