'use strict'

const Db = require('../../../../src/lib/db')
const Test = require('tapes')(require('tape'))
const sinon = require('sinon')
const watchList = require('../../../../src/models/fxTransfer/watchList')
const { TABLE_NAMES } = require('../../../../src/shared/constants')

Test('Transfer facade', async (watchListTest) => {
  let sandbox

  watchListTest.beforeEach(t => {
    sandbox = sinon.createSandbox()
    Db.fxWatchList = {
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

  watchListTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await watchListTest.test('getItemInWatchListByCommitRequestId should return the item in watch list', async (t) => {
    const commitRequestId = '123456'
    const expectedItem = { commitRequestId: '123456', amount: 100 }

    // Mock the database findOne method
    Db.from(TABLE_NAMES.fxWatchList).findOne.returns(expectedItem)

    const result = await watchList.getItemInWatchListByCommitRequestId(commitRequestId)

    t.deepEqual(result, expectedItem, 'Should return the expected item')
    t.ok(Db.from(TABLE_NAMES.fxWatchList).findOne.calledOnceWithExactly({ commitRequestId }), 'Should call findOne method with the correct arguments')

    t.end()
  })

  await watchListTest.test('getItemsInWatchListByDeterminingTransferId should return the items in watch list', async (t) => {
    const determiningTransferId = '789012'
    const expectedItems = [
      { determiningTransferId: '789012', amount: 200 },
      { determiningTransferId: '789012', amount: 300 }
    ]

    // Mock the database find method
    Db.from(TABLE_NAMES.fxWatchList).find.returns(expectedItems)

    const result = await watchList.getItemsInWatchListByDeterminingTransferId(determiningTransferId)

    t.deepEqual(result, expectedItems, 'Should return the expected items')
    t.ok(Db.from(TABLE_NAMES.fxWatchList).find.calledOnceWithExactly({ determiningTransferId }), 'Should call find method with the correct arguments')
    t.end()
  })

  await watchListTest.test('addToWatchList should add the record to the watch list', async (t) => {
    const record = { commitRequestId: '123456', amount: 100 }

    // Mock the database insert method
    Db.from(TABLE_NAMES.fxWatchList).insert.returns()

    await watchList.addToWatchList(record)

    t.ok(Db.from(TABLE_NAMES.fxWatchList).insert.calledOnceWithExactly(record), 'Should call insert method with the correct arguments')
    t.end()
  })

  watchListTest.end()
})
