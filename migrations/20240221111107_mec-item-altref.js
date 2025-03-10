export async function up(knex) {
  await knex.schema.createTable('mec-item-altref', (table) => {
    table.increments('id')
    table.string('text')
  })
}

export async function down(knex) {
  await knex.schema.dropTable('mec-item-altref')
}
