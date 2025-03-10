import {
  KnexService
} from '@feathersjs/knex'

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class MecItemService extends KnexService {
  constructor(options) {
    super(options);
  }

  //Setting the adapter in the service method params allows do dynamically modify the database adapter options based on the request. This e.g. allows to temporarily allow multiple entry creation/changes or the pagination settings.
  //Overide the default create method to add the adapter to the params
  /*
  // Adding the option includeTriggerModifications 
// allows you to run statements on tables 
// that contain triggers. Only affects MSSQL.
knex('books')
  .insert(
    {title: 'Alice in Wonderland'}, 
    ['id'], 
    { includeTriggerModifications: true }
  )
  */

  async create(data, params) {
    let result = await this.options.Model('mec_item').insert(data, ['Item_key'], {
      includeTriggerModifications: true
    });

    return result;
  }
}

export const getOptions = (app) => {
  return {
    id: 'Item_key',
    paginate: app.get('paginate'),
    Model: app.get('mssqlClient'),
    name: 'mec_item',
    multi: true
  }
}