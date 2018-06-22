'use strict'

const Test = require('tape')
const Permissions = require('../../../../src/domain/security/permissions')

Test('Permissions', permissionsTest => {
  permissionsTest.test('should contain Participant permissions', test => {
    test.equal(Permissions.PARTICIPANTS_LIST.key, 'PARTICIPANTS_LIST')
    test.equal(Permissions.PARTICIPANTS_UPDATE.key, 'PARTICIPANTS_UPDATE')
    test.end()
  })
})
