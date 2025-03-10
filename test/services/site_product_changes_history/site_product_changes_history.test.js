// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert'
import { app } from '../../../src/app.js'

describe('site_product_changes_history service', () => {
  it('registered the service', () => {
    const service = app.service('site_product_changes_history')

    assert.ok(service, 'Registered the service')
  })
})
