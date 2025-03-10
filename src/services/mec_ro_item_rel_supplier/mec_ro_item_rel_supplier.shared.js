export const mecRoItemRelSupplierPath = 'mec_ro_item_rel_supplier'

export const mecRoItemRelSupplierMethods = ['find', 'get', 'create', 'patch', 'remove']

export const mecRoItemRelSupplierClient = (client) => {
  const connection = client.get('connection')

  client.use(mecRoItemRelSupplierPath, connection.service(mecRoItemRelSupplierPath), {
    methods: mecRoItemRelSupplierMethods
  })
}
