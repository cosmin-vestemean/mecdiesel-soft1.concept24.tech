export const mecItemProducerRelationPath = 'mec_item_producer_relation'

export const mecItemProducerRelationMethods = ['find', 'get', 'create', 'patch', 'remove']

export const mecItemProducerRelationClient = (client) => {
  const connection = client.get('connection')

  client.use(mecItemProducerRelationPath, connection.service(mecItemProducerRelationPath), {
    methods: mecItemProducerRelationMethods
  })
}
