'use strict'

const Db = require('../../../../src/lib/db')
const Test = require('tapes')(require('tape'))
const sinon = require('sinon')
const duplicateCheck = require('../../../../src/models/fxTransfer/duplicateCheck')
const { TABLE_NAMES } = require('../../../../src/shared/constants')

Test('DuplicateCheck', async (duplicateCheckTest) => {
  let sandbox

  duplicateCheckTest.beforeEach(t => {
    sandbox = sinon.createSandbox()
    Db.fxTransferDuplicateCheck = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub()
    }
    Db.fxTransferErrorDuplicateCheck = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub()
    }
    Db.fxTransferFulfilmentDuplicateCheck = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub()
    }
    Db.from = (table) => {
      return {
        ...Db[table]
      }
    }
    t.end()
  })

  duplicateCheckTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  duplicateCheckTest.test('getFxTransferDuplicateCheck should retrieve the record from fxTransferDuplicateCheck table if present', async (test) => {
    const commitRequestId = '123456789'
    const expectedRecord = { id: 1, commitRequestId, hash: 'abc123' }

    // Mock the Db.from().findOne() method to return the expected record
    Db.from(TABLE_NAMES.fxTransferDuplicateCheck).findOne.resolves(expectedRecord)

    try {
      const result = await duplicateCheck.getFxTransferDuplicateCheck(commitRequestId)

      test.deepEqual(result, expectedRecord, 'Should return the expected record')
      test.ok(Db.from(TABLE_NAMES.fxTransferDuplicateCheck).findOne.calledOnceWith({ commitRequestId }), 'Should call Db.from().findOne() with the correct parameters')

      test.end()
    } catch (error) {
      test.fail(`Error thrown: ${error}`)
      test.end()
    }
  })

  duplicateCheckTest.test('getFxTransferDuplicateCheck should throw an error if Db.from().findOne() fails', async (test) => {
    const commitRequestId = '123456789'
    const expectedError = new Error('Database error')

    // Mock the Db.from().findOne() method to throw an error
    Db.from(TABLE_NAMES.fxTransferDuplicateCheck).findOne.throws(expectedError)

    try {
      await duplicateCheck.getFxTransferDuplicateCheck(commitRequestId)

      test.fail('Should throw an error')
      test.end()
    } catch (error) {
      test.equal(error.message, expectedError.message, 'Should throw the expected error')
      test.ok(Db.from(TABLE_NAMES.fxTransferDuplicateCheck).findOne.calledOnceWith({ commitRequestId }), 'Should call Db.from().findOne() with the correct parameters')

      test.end()
    }
  })

  duplicateCheckTest.test('saveFxTransferDuplicateCheck should insert a record into fxTransferDuplicateCheck table', async (test) => {
    const commitRequestId = '123456789'
    const hash = 'abc123'
    const expectedId = 1

    // Mock the Db.from().insert() method to return the expected id
    Db.from(TABLE_NAMES.fxTransferDuplicateCheck).insert.resolves(expectedId)

    try {
      const result = await duplicateCheck.saveFxTransferDuplicateCheck(commitRequestId, hash)

      test.equal(result, expectedId, 'Should return the expected id')
      test.ok(Db.from(TABLE_NAMES.fxTransferDuplicateCheck).insert.calledOnceWith({ commitRequestId, hash }), 'Should call Db.from().insert() with the correct parameters')

      test.end()
    } catch (error) {
      test.fail(`Error thrown: ${error}`)
      test.end()
    }
  })

  duplicateCheckTest.test('saveFxTransferDuplicateCheck should throw an error if Db.from().insert() fails', async (test) => {
    const commitRequestId = '123456789'
    const hash = 'abc123'
    const expectedError = new Error('Database error')

    // Mock the Db.from().insert() method to throw an error
    Db.from(TABLE_NAMES.fxTransferDuplicateCheck).insert.throws(expectedError)

    try {
      await duplicateCheck.saveFxTransferDuplicateCheck(commitRequestId, hash)

      test.fail('Should throw an error')
      test.end()
    } catch (error) {
      test.equal(error.message, expectedError.message, 'Should throw the expected error')
      test.ok(Db.from(TABLE_NAMES.fxTransferDuplicateCheck).insert.calledOnceWith({ commitRequestId, hash }), 'Should call Db.from().insert() with the correct parameters')

      test.end()
    }
  })

  duplicateCheckTest.test('getFxTransferErrorDuplicateCheck should retrieve the record from fxTransferErrorDuplicateCheck table if present', async (test) => {
    const commitRequestId = '123456789'
    const expectedRecord = { id: 1, commitRequestId, hash: 'abc123' }
    // Mock the Db.from().findOne() method to return the expected record
    Db.from(TABLE_NAMES.fxTransferErrorDuplicateCheck).findOne.resolves(expectedRecord)
    try {
      const result = await duplicateCheck.getFxTransferErrorDuplicateCheck(commitRequestId)
      test.deepEqual(result, expectedRecord, 'Should return the expected record')
      test.ok(Db.from(TABLE_NAMES.fxTransferErrorDuplicateCheck).findOne.calledOnceWith({ commitRequestId }), 'Should call Db.from().findOne() with the correct parameters')
      test.end()
    } catch (error) {
      test.fail(`Error thrown: ${error}`)
      test.end()
    }
  })

  duplicateCheckTest.test('getFxTransferErrorDuplicateCheck should throw an error if Db.from().findOne() fails', async (test) => {
    const commitRequestId = '123456789'
    const expectedError = new Error('Database error')
    // Mock the Db.from().findOne() method to throw an error
    Db.from(TABLE_NAMES.fxTransferErrorDuplicateCheck).findOne.throws(expectedError)
    try {
      await duplicateCheck.getFxTransferErrorDuplicateCheck(commitRequestId)
      test.fail('Should throw an error')
      test.end()
    } catch (error) {
      test.equal(error.message, expectedError.message, 'Should throw the expected error')
      test.ok(Db.from(TABLE_NAMES.fxTransferErrorDuplicateCheck).findOne.calledOnceWith({ commitRequestId }), 'Should call Db.from().findOne() with the correct parameters')
      test.end()
    }
  })

  duplicateCheckTest.test('saveFxTransferErrorDuplicateCheck should insert a record into fxTransferErrorDuplicateCheck table', async (test) => {
    const commitRequestId = '123456789'
    const hash = 'abc123'
    const expectedId = 1
    // Mock the Db.from().insert() method to return the expected id
    Db.from(TABLE_NAMES.fxTransferErrorDuplicateCheck).insert.resolves(expectedId)
    try {
      const result = await duplicateCheck.saveFxTransferErrorDuplicateCheck(commitRequestId, hash)
      test.equal(result, expectedId, 'Should return the expected id')
      test.ok(Db.from(TABLE_NAMES.fxTransferErrorDuplicateCheck).insert.calledOnceWith({ commitRequestId, hash }), 'Should call Db.from().insert() with the correct parameters')
      test.end()
    } catch (error) {
      test.fail(`Error thrown: ${error}`)
      test.end()
    }
  })

  duplicateCheckTest.test('saveFxTransferErrorDuplicateCheck should throw an error if Db.from().insert() fails', async (test) => {
    const commitRequestId = '123456789'
    const hash = 'abc123'
    const expectedError = new Error('Database error')
    // Mock the Db.from().insert() method to throw an error
    Db.from(TABLE_NAMES.fxTransferErrorDuplicateCheck).insert.throws(expectedError)
    try {
      await duplicateCheck.saveFxTransferErrorDuplicateCheck(commitRequestId, hash)
      test.fail('Should throw an error')
      test.end()
    } catch (error) {
      test.equal(error.message, expectedError.message, 'Should throw the expected error')
      test.ok(Db.from(TABLE_NAMES.fxTransferErrorDuplicateCheck).insert.calledOnceWith({ commitRequestId, hash }), 'Should call Db.from().insert() with the correct parameters')
      test.end()
    }
  })

  duplicateCheckTest.test('getFxTransferFulfilmentDuplicateCheck should retrieve the record from fxTransferFulfilmentDuplicateCheck table if present', async (test) => {
    const commitRequestId = '123456789'
    const expectedRecord = { id: 1, commitRequestId, hash: 'abc123' }
    // Mock the Db.from().findOne() method to return the expected record
    Db.from(TABLE_NAMES.fxTransferFulfilmentDuplicateCheck).findOne.resolves(expectedRecord)
    try {
      const result = await duplicateCheck.getFxTransferFulfilmentDuplicateCheck(commitRequestId)
      test.deepEqual(result, expectedRecord, 'Should return the expected record')
      test.ok(Db.from(TABLE_NAMES.fxTransferFulfilmentDuplicateCheck).findOne.calledOnceWith({ commitRequestId }), 'Should call Db.from().findOne() with the correct parameters')
      test.end()
    } catch (error) {
      test.fail(`Error thrown: ${error}`)
      test.end()
    }
  })

  duplicateCheckTest.test('getFxTransferFulfilmentDuplicateCheck should throw an error if Db.from().findOne() fails', async (test) => {
    const commitRequestId = '123456789'
    const expectedError = new Error('Database error')
    // Mock the Db.from().findOne() method to throw an error
    Db.from(TABLE_NAMES.fxTransferFulfilmentDuplicateCheck).findOne.throws(expectedError)
    try {
      await duplicateCheck.getFxTransferFulfilmentDuplicateCheck(commitRequestId)
      test.fail('Should throw an error')
      test.end()
    } catch (error) {
      test.equal(error.message, expectedError.message, 'Should throw the expected error')
      test.ok(Db.from(TABLE_NAMES.fxTransferFulfilmentDuplicateCheck).findOne.calledOnceWith({ commitRequestId }), 'Should call Db.from().findOne() with the correct parameters')
      test.end()
    }
  })

  duplicateCheckTest.test('saveFxTransferFulfilmentDuplicateCheck should insert a record into fxTransferFulfilmentDuplicateCheck table', async (test) => {
    const commitRequestId = '123456789'
    const hash = 'abc123'
    const expectedId = 1
    // Mock the Db.from().insert() method to return the expected id
    Db.from(TABLE_NAMES.fxTransferFulfilmentDuplicateCheck).insert.resolves(expectedId)
    try {
      const result = await duplicateCheck.saveFxTransferFulfilmentDuplicateCheck(commitRequestId, hash)
      test.equal(result, expectedId, 'Should return the expected id')
      test.ok(Db.from(TABLE_NAMES.fxTransferFulfilmentDuplicateCheck).insert.calledOnceWith({ commitRequestId, hash }), 'Should call Db.from().insert() with the correct parameters')
      test.end()
    } catch (error) {
      test.fail(`Error thrown: ${error}`)
      test.end()
    }
  })

  duplicateCheckTest.test('saveFxTransferFulfilmentDuplicateCheck should throw an error if Db.from().insert() fails', async (test) => {
    const commitRequestId = '123456789'
    const hash = 'abc123'
    const expectedError = new Error('Database error')
    // Mock the Db.from().insert() method to throw an error
    Db.from(TABLE_NAMES.fxTransferFulfilmentDuplicateCheck).insert.throws(expectedError)
    try {
      await duplicateCheck.saveFxTransferFulfilmentDuplicateCheck(commitRequestId, hash)
      test.fail('Should throw an error')
      test.end()
    } catch (error) {
      test.equal(error.message, expectedError.message, 'Should throw the expected error')
      test.ok(Db.from(TABLE_NAMES.fxTransferFulfilmentDuplicateCheck).insert.calledOnceWith({ commitRequestId, hash }), 'Should call Db.from().insert() with the correct parameters')
      test.end()
    }
  })

  duplicateCheckTest.end()
})
