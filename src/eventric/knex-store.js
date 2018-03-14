'use strict'

const Db = require('../db')
const Uuid = require('uuid4')

class KnexStore {
  constructor () {
    this._getNextSequenceNumber = this._getNextSequenceNumber.bind(this)
    this._toDomainEvent = this._toDomainEvent.bind(this)
    this._insertDomainEvent = this._insertDomainEvent.bind(this)
    this._findDomainEvents = this._findDomainEvents.bind(this)
  }

  _findDomainEvents (criteria, callback) {
    return Db.from(this._tableName)
      .find(criteria)
      .then(results => callback(null, results.map(this._toDomainEvent)))
      .catch(e => callback(e, null))
  }

  _getNextSequenceNumber (domainEvent) {
    return Db.from(this._tableName)
      .max({ aggregateId: domainEvent.aggregate.id }, 'sequenceNumber')
      .then(max => {
        if (domainEvent.ensureIsFirstDomainEvent || !max || max === null) {
          return 1
        } else {
          return max + 1
        }
      })
  }

  _toDomainEvent (event) {
    return {
      id: event.sequenceNumber,
      name: event.name,
      payload: event.payload,
      aggregate: { id: event.aggregateId, name: event.aggregateName },
      context: this._context.name,
      timestamp: (new Date(event.timestamp)).getTime()
    }
  }

  _insertDomainEvent (sequenceNumber, domainEvent) {
    return Db.from(this._tableName).insert({
      eventId: Uuid(),
      name: domainEvent.name,
      payload: JSON.stringify(domainEvent.payload),
      aggregateId: domainEvent.aggregate.id,
      aggregateName: domainEvent.aggregate.name,
      sequenceNumber: sequenceNumber,
      timestamp: new Date(domainEvent.timestamp)
    })
  }

  initialize (context) {
    this._context = context
    return Promise.resolve().then(() => {
      this._tableName = this._context.name[0].toLowerCase() + this._context.name.substr(1) + 'DomainEvents'
      return this
    })
  }

  saveDomainEvent (domainEvent) {
    return this._getNextSequenceNumber(domainEvent).then(sequenceNumber => this._insertDomainEvent(sequenceNumber, domainEvent))
      .then(result => this._toDomainEvent(result))
  }

  findDomainEventsByName (domainEventNames, callback) {
    this._findDomainEvents({ name: [].concat(domainEventNames) }, callback)
  }

  findDomainEventsByAggregateId (aggregateIds, callback) {
    this._findDomainEvents({ aggregateId: [].concat(aggregateIds) }, callback)
  }

  findDomainEventsByNameAndAggregateId (domainEventNames, aggregateIds, callback) {
    this._findDomainEvents({ name: [].concat(domainEventNames), aggregateId: [].concat(aggregateIds) }, callback)
  }

  destroy () { }
}

exports.default = KnexStore
