// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert'
import { app } from '../../../src/app.js'

describe('mec_ro_item_rel_supplier service', () => {
  it('registered the service', () => {
    const service = app.service('mec_ro_item_rel_supplier')

    assert.ok(service, 'Registered the service')
  })
})
