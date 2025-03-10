export async function up(knex) {
  await knex.schema.createTable('site-product-frequent-changes', (table) => {
    table.increments('id')
    table.string('text')
  })
}

export async function down(knex) {
  await knex.schema.dropTable('site-product-frequent-changes')
}
