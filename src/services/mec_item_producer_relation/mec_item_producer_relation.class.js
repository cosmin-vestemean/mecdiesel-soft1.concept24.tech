import { KnexService } from '@feathersjs/knex'

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class MecItemProducerRelationService extends KnexService {
  constructor(options) {
    super(options);
  }

  async create(data, params) {
    let result = await this.options.Model('mec_item_producer_relation').insert(data, ['Item_key'], {
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
    name: 'mec_item_producer_relation',
    multi: true
  }
}
