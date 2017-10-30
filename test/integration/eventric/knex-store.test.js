'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Eventric = require('eventric')
const KnexStore = require('../../../src/eventric/knex-store').default

const contextName = 'Ledger'

const createAndInitializeStore = () => {
  let store = new KnexStore()
  return store.initialize(Eventric.context(contextName))
}

const compareDomainEvent = (test, saved, domainEvent) => {
  test.ok(saved.id)
  test.equal(saved.context, contextName)
  test.equal(saved.name, domainEvent.name)
  test.deepEqual(saved.payload, domainEvent.payload)
  test.equal(saved.aggregate.id, domainEvent.aggregate.id)
  test.equal(saved.aggregate.name, domainEvent.aggregate.name)
}

Test('Knex store', modelTest => {
  let createDomainEvent = (name = 'test', payload = {}, aggregateId = null) => {
    return {
      name: name,
      payload: payload,
      aggregate: {
        id: aggregateId || Uuid(),
        name: 'TestAggregate'
      },
      timestamp: new Date(),
      ensureIsFirstDomainEvent: true
    }
  }

  modelTest.test('saveDomainEvent should', saveDomainEventTest => {
    saveDomainEventTest.test('save a domain event', test => {
      let domainEvent = createDomainEvent()

      createAndInitializeStore()
        .then(store => {
          store.saveDomainEvent(domainEvent)
            .then(saved => {
              compareDomainEvent(test, saved, domainEvent)
              test.end()
            })
        })
    })

    saveDomainEventTest.end()
  })

  modelTest.test('findDomainEventsByName should', findByNameTest => {
    findByNameTest.test('return domain events by name', test => {
      let myDomainEvent = createDomainEvent('mine')
      let yourDomainEvent = createDomainEvent('yours')

      createAndInitializeStore()
        .then(store => {
          store.saveDomainEvent(myDomainEvent)
            .then(() => store.saveDomainEvent(yourDomainEvent))
            .then(() => {
              store.findDomainEventsByName(myDomainEvent.name, (err, found) => {
                if (err) {
                  test.fail()
                  test.end()
                }
                test.equal(found.length, 1)
                compareDomainEvent(test, found[0], myDomainEvent)
                test.end()
              })
            })
        })
    })

    findByNameTest.end()
  })

  modelTest.test('findDomainEventsByAggregateId should', findByAggregateIdTest => {
    findByAggregateIdTest.test('return domain events by name', test => {
      let myAggregateId = Uuid()
      let yourAggregateId = Uuid()
      let myDomainEvent = createDomainEvent('mine', {}, myAggregateId)
      let yourDomainEvent = createDomainEvent('mine', {}, yourAggregateId)

      createAndInitializeStore()
        .then(store => {
          store.saveDomainEvent(myDomainEvent)
            .then(() => store.saveDomainEvent(yourDomainEvent))
            .then(() => {
              store.findDomainEventsByAggregateId(myAggregateId, (err, found) => {
                if (err) {
                  test.fail()
                  test.end()
                }
                test.equal(found.length, 1)
                compareDomainEvent(test, found[0], myDomainEvent)
                test.end()
              })
            })
        })
    })

    findByAggregateIdTest.end()
  })

  modelTest.test('findDomainEventsByNameAndAggregateId should', findByNameAndAggregateIdTest => {
    findByNameAndAggregateIdTest.test('return domain events by name', test => {
      let myAggregateId = Uuid()
      let yourAggregateId = Uuid()
      let myDomainEvent = createDomainEvent('mine', {}, myAggregateId)
      let yourDomainEvent = createDomainEvent('mine', {}, yourAggregateId)

      createAndInitializeStore()
        .then(store => {
          store.saveDomainEvent(myDomainEvent)
            .then(() => store.saveDomainEvent(yourDomainEvent))
            .then(() => {
              store.findDomainEventsByNameAndAggregateId(myDomainEvent.name, myAggregateId, (err, found) => {
                if (err) {
                  test.fail()
                  test.end()
                }
                test.equal(found.length, 1)
                compareDomainEvent(test, found[0], myDomainEvent)
                test.end()
              })
            })
        })
    })

    findByNameAndAggregateIdTest.end()
  })

  modelTest.end()
})
