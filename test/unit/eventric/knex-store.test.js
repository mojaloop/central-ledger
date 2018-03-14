'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const KnexStore = require(`${src}/eventric/knex-store`).default
const Db = require(`${src}/db`)

Test('knex store test', storeTest => {
  let sandbox
  let dbMethodsStub

  let createDomainEvent = (payload = {}) => {
    return {
      name: 'test',
      payload: payload,
      aggregate: {
        id: Uuid(),
        name: 'TestAggregate'
      },
      timestamp: new Date(),
      ensureIsFirstDomainEvent: true
    }
  }

  let createEvent = () => {
    return {
      sequenceNumber: 1,
      name: 'SomeEventName',
      payload: {},
      aggregateId: Uuid(),
      aggregateName: 'TestAggregate',
      timestamp: new Date().toISOString()
    }
  }

  let createStore = (contextName = 'SomeName') => {
    let store = new KnexStore()
    return P.resolve(store.initialize({ name: contextName }))
      .then(ctx => {
        Db.from.withArgs(ctx._tableName).returns(dbMethodsStub)
        return ctx
      })
  }

  let setSequenceNumber = (aggregateId, sequenceNumber = 0) => {
    dbMethodsStub.max.withArgs({ aggregateId }, 'sequenceNumber').returns(P.resolve(sequenceNumber))
  }

  storeTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    dbMethodsStub = {
      insert: sandbox.stub(),
      find: sandbox.stub(),
      max: sandbox.stub()
    }
    Db.from = sandbox.stub()
    t.end()
  })

  storeTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  storeTest.test('initialize should', initializeTest => {
    initializeTest.test('set table name and context', test => {
      let context = {
        name: 'SomeName'
      }

      let postgresStore = new KnexStore()

      postgresStore.initialize(context)
        .then(store => {
          test.equal(store._tableName, 'someNameDomainEvents')
          test.equal(store._context, context)
          test.end()
        })
    })
    initializeTest.end()
  })

  storeTest.test('_getNextSequenceNumber should', seqTest => {
    seqTest.test('return 1 if domainEvent is firstDomainEvent', test => {
      let domainEvent = createDomainEvent()
      setSequenceNumber(domainEvent.aggregate.id, -12)

      createStore().then(store => store._getNextSequenceNumber(domainEvent))
      .then(result => {
        test.equal(result, 1)
        test.end()
      })
    })

    seqTest.test('return 1 if no records exist for aggregate', test => {
      let domainEvent = createDomainEvent()
      domainEvent.ensureIsFirstDomainEvent = false

      setSequenceNumber(domainEvent.aggregate.id, null)

      createStore().then(s => s._getNextSequenceNumber(domainEvent))
      .then(result => {
        test.equal(result, 1)
        test.end()
      })
    })

    seqTest.test('return max + 1 if max sequenceNumber found', test => {
      let domainEvent = createDomainEvent()
      domainEvent.ensureIsFirstDomainEvent = false

      let maxSequenceNumber = 100
      setSequenceNumber(domainEvent.aggregate.id, maxSequenceNumber)

      createStore().then(s => s._getNextSequenceNumber(domainEvent))
      .then(result => {
        test.equal(result, maxSequenceNumber + 1)
        test.end()
      })
    })

    seqTest.end()
  })

  storeTest.test('saveDomainEvent should', saveDomainEventTest => {
    saveDomainEventTest.test('insert event in db', test => {
      let domainEvent = createDomainEvent()

      let insertArg
      let insertAsyncCalled = false

      dbMethodsStub.insert = (arg1) => {
        insertArg = arg1
        insertAsyncCalled = true
        return P.resolve(arg1)
      }

      setSequenceNumber(domainEvent.aggregate.id)

      createStore()
        .then(s => {
          s.saveDomainEvent(domainEvent)
            .then(result => {
              test.ok(insertAsyncCalled)

              test.ok(insertArg.eventId)
              test.equal(insertArg.name, domainEvent.name)
              test.equal(insertArg.payload, '{}')
              test.equal(insertArg.aggregateId, domainEvent.aggregate.id)
              test.equal(insertArg.aggregateName, domainEvent.aggregate.name)
              test.equal(insertArg.sequenceNumber, 1)
              test.equal(insertArg.timestamp.toISOString(), domainEvent.timestamp.toISOString())

              test.equal(result.id, 1)
              test.equal(result.name, domainEvent.name)
              test.equal(result.payload, '{}')
              test.deepEqual(result.aggregate, domainEvent.aggregate)
              test.equal(result.context, 'SomeName')
              test.equal(result.timestamp, domainEvent.timestamp.getTime())
              test.end()
            })
        })
    })

    saveDomainEventTest.test('throw error if error not duplicate key error', test => {
      let domainEvent = createDomainEvent()

      let error = new Error('not duplicate key error')

      dbMethodsStub.insert.returns(P.reject(error))

      setSequenceNumber(domainEvent.aggregate.id)

      createStore()
        .then(store => store.saveDomainEvent(domainEvent))
        .then(() => {
          test.fail('Expected exception to be thrown')
          test.end()
        })
        .catch(e => {
          test.equal(e, error)
          test.end()
        })
    })

    saveDomainEventTest.end()
  })

  storeTest.test('findDomainEventsByName should', findByNameTest => {
    findByNameTest.test('find events by name', test => {
      let domainEventNames = ['name1', 'name2']
      let results = [createEvent(), createEvent()]

      dbMethodsStub.find.withArgs({ name: domainEventNames }).returns(P.resolve(results))

      createStore()
      .then(s => {
        let cb = (err, result) => {
          test.notOk(err)
          test.deepEqual(result, results.map(x => s._toDomainEvent(x)))
          test.end()
        }
        s.findDomainEventsByName(domainEventNames, cb)
      })
    })

    findByNameTest.test('convert name to array', test => {
      let domainEventName = 'name1'
      let results = [createEvent(), createEvent()]

      dbMethodsStub.find.withArgs({ name: [domainEventName] }).returns(P.resolve(results))

      createStore()
      .then(s => {
        let cb = (err, result) => {
          test.notOk(err)
          test.deepEqual(result, results.map(x => s._toDomainEvent(x)))
          test.end()
        }
        s.findDomainEventsByName(domainEventName, cb)
      })
    })

    findByNameTest.test('return error if db.find throws error', test => {
      let error = new Error()
      dbMethodsStub.find.returns(P.reject(error))

      let cb = (err, result) => {
        test.equal(err, error)
        test.notOk(result)
        test.end()
      }

      createStore().then(s => s.findDomainEventsByName('somename', cb))
    })

    findByNameTest.end()
  })

  storeTest.test('findDomainEventsByAggregateId should', findByAggregateIdTest => {
    findByAggregateIdTest.test('find events by aggregateId', test => {
      let ids = [Uuid(), Uuid()]
      let results = [createEvent(), createEvent()]

      dbMethodsStub.find.withArgs({ aggregateId: ids }).returns(P.resolve(results))

      createStore()
      .then(s => {
        let cb = (err, result) => {
          test.notOk(err)
          test.deepEqual(result, results.map(x => s._toDomainEvent(x)))
          test.end()
        }
        s.findDomainEventsByAggregateId(ids, cb)
      })
    })

    findByAggregateIdTest.test('convert id to array', test => {
      let id = Uuid()
      let results = [createEvent(), createEvent()]

      dbMethodsStub.find.withArgs({ aggregateId: [id] }).returns(P.resolve(results))

      createStore()
      .then(s => {
        let cb = (err, result) => {
          test.notOk(err)
          test.deepEqual(result, results.map(x => s._toDomainEvent(x)))
          test.end()
        }
        s.findDomainEventsByAggregateId(id, cb)
      })
    })

    findByAggregateIdTest.test('return error if db.whereIn throws error', test => {
      let error = new Error()
      dbMethodsStub.find.returns(P.reject(error))

      let cb = (err, result) => {
        test.equal(err, error)
        test.notOk(result)
        test.end()
      }

      createStore().then(s => s.findDomainEventsByAggregateId(Uuid(), cb))
    })

    findByAggregateIdTest.end()
  })

  storeTest.test('findDomainEventsByNameAndAggregateId should', findByNameAndAggregateIdTest => {
    findByNameAndAggregateIdTest.test('find events by name and aggregateId', test => {
      let domainEventNames = ['name1', 'name2']
      let ids = [Uuid(), Uuid()]
      let results = [createEvent(), createEvent()]

      dbMethodsStub.find.withArgs({ name: domainEventNames, aggregateId: ids }).returns(P.resolve(results))

      createStore()
      .then(s => {
        let cb = (err, result) => {
          test.notOk(err)
          test.deepEqual(result, results.map(x => s._toDomainEvent(x)))
          test.end()
        }
        s.findDomainEventsByNameAndAggregateId(domainEventNames, ids, cb)
      })
    })

    findByNameAndAggregateIdTest.test('convert name and id to array', test => {
      let name = 'name1'
      let id = Uuid()
      let results = [createEvent(), createEvent()]

      dbMethodsStub.find.withArgs({ name: [name], aggregateId: [id] }).returns(P.resolve(results))

      createStore()
      .then(s => {
        let cb = (err, result) => {
          test.notOk(err)
          test.deepEqual(result, results.map(x => s._toDomainEvent(x)))
          test.end()
        }
        s.findDomainEventsByNameAndAggregateId(name, id, cb)
      })
    })

    findByNameAndAggregateIdTest.test('return error if db.whereIn throws error', test => {
      let name = 'name'
      let id = Uuid()
      let error = new Error()

      dbMethodsStub.find.withArgs({ name: [name], aggregateId: [id] }).returns(P.reject(error))

      let cb = (err, result) => {
        test.equal(err, error)
        test.notOk(result)
        test.end()
      }

      createStore().then(s => s.findDomainEventsByNameAndAggregateId(name, id, cb))
    })

    findByNameAndAggregateIdTest.end()
  })

  storeTest.test('destroy should', destroyTest => {
    destroyTest.test('do nothing', test => {
      createStore()
      .then(s => {
        s.destroy()
        test.pass()
        test.end()
      })
    })

    destroyTest.end()
  })

  storeTest.end()
})
