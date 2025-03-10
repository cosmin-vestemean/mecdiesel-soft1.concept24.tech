// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert'
import { app } from '../../../src/app.js'

describe('mec_item_producer_relation service', () => {
  it('registered the service', () => {
    const service = app.service('mec_item_producer_relation')

    assert.ok(service, 'Registered the service')
  })
})
