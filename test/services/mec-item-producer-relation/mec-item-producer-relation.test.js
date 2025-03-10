// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert'
import { app } from '../../../src/app.js'

describe('mec-item-producer-relation service', () => {
  it('registered the service', () => {
    const service = app.service('mec-item-producer-relation')

    assert.ok(service, 'Registered the service')
  })
})
