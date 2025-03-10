export async function up(knex) {
  await knex.schema.createTable('mec-ro-item-rel-supplier', (table) => {
    table.increments('id')
    table.string('text')
  })
}

export async function down(knex) {
  await knex.schema.dropTable('mec-ro-item-rel-supplier')
}
