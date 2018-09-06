/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

const src = '../../../../../src/'
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Proxyquire = require('proxyquire')
const Config = require(`${src}/lib/config`)
// const CronCronJob = require('cron').CronJob
// const KafkaConsumer = require('@mojaloop/central-services-shared').Kafka.Consumer

Test('setup', setupTest => {
  let sandbox
  let KafkaCron
  let CronJobStub
  let CronJobStubClassDestroySpy
  let RegisterHandlersStub
  // let RegisterHandlersStubSpy
  let fspList
  let DAOStub
  let ConsumerStub

  setupTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()

    // sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(P.resolve())
    // sandbox.stub(KafkaConsumer.prototype, 'connect').returns(P.resolve())
    // sandbox.stub(KafkaConsumer.prototype, 'consume').returns(P.resolve())
    // sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(P.resolve())

    // let CronJobClassStub = sandbox.stub(CronCronJob)
    //
    // CronJobClassStub.stub(CronCronJob.prototype, 'constructor').callsFake((opt) => {
    //   opt.onTick()
    // })

    CronJobStubClassDestroySpy = sandbox.stub().returns(P.resolve())

    class CronJobStubClass {
      constructor (opts) {
        this.opts = opts
        // opts.onTick()
      }

      start () {
        let func = async () => {
          await this.opts.onTick()
        }

        return func()
      }

      destroy () {
        return CronJobStubClassDestroySpy()
      }

      get running () {
        return true
      }
    }

    CronJobStub = {
      CronJob: CronJobStubClass
    }

    RegisterHandlersStub = {
      registerAllHandlers: sandbox.stub().returns(P.resolve()),
      transfers: {
        registerPrepareHandlers: sandbox.stub().returns(P.resolve()),
        registerTransferHandler: sandbox.stub().returns(P.resolve()),
        registerFulfilHandler: sandbox.stub().returns(P.resolve())
        // registerRejectHandler: sandbox.stub().returns(P.resolve())
      },
      positions: {
        registerPositionHandlers: sandbox.stub().returns(P.resolve())
      }
    }

    // RegisterHandlersStubSpy = sandbox.spy(RegisterHandlersStub)

    fspList = ['dfsp1', 'dfsp2']

    DAOStub = {
      retrieveAllParticipants: sandbox.stub().returns(P.resolve(fspList))
    }

    ConsumerStub = {
      getConsumer: sandbox.stub().returns(undefined)
    }

    test.end()
  })

  setupTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  setupTest.test('KafkaCron should', async (cronTest) => {
    cronTest.test(`register prepare handlers for ${JSON.stringify(fspList)}`, async (test) => {
      // setup stubs
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      await KafkaCron.start('prepare')
      test.ok(RegisterHandlersStub.transfers.registerPrepareHandlers.callCount === fspList.length)
      test.end()
    })

    cronTest.test(`register prepare handlers for ${JSON.stringify(fspList)} first FSP already being registered`, async (test) => {
      // setup stubs
      let getConsumerStub = sandbox.stub().returns(P.resolve())
      getConsumerStub.onCall(0).returns(undefined)
      ConsumerStub = {
        getConsumer: getConsumerStub
      }
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      await KafkaCron.start('prepare')
      test.ok(RegisterHandlersStub.transfers.registerPrepareHandlers.callCount === (fspList.length - 1))
      test.end()
    })

    cronTest.test(`register prepare handlers for ${JSON.stringify(fspList)} for Consumer.getConsumer throwing an exception`, async (test) => {
      // setup stubs
      let getConsumerStub = sandbox.stub().returns(P.resolve())
      getConsumerStub.onCall(0).throws('Error!')
      ConsumerStub = {
        getConsumer: getConsumerStub
      }
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      await KafkaCron.start('prepare')
      test.ok(RegisterHandlersStub.transfers.registerPrepareHandlers.callCount === (fspList.length - 1))
      test.end()
    })

    cronTest.test(`register position handlers for ${JSON.stringify(fspList)}`, async (test) => {
      // setup stubs
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      await KafkaCron.start('position')
      test.ok(RegisterHandlersStub.positions.registerPositionHandlers.callCount === (fspList.length * 3))
      test.end()
    })

    cronTest.test(`register position handlers for ${JSON.stringify(fspList)} first FSP already being registered`, async (test) => {
      // setup stubs
      let getConsumerStub = sandbox.stub().returns(P.resolve())
      getConsumerStub.onCall(0).returns(undefined)
      ConsumerStub = {
        getConsumer: getConsumerStub
      }
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      await KafkaCron.start('position')
      test.ok(RegisterHandlersStub.positions.registerPositionHandlers.callCount === 1)
      test.end()
    })

    cronTest.test(`register position handlers for ${JSON.stringify(fspList)} for Consumer.getConsumer throwing an exception`, async (test) => {
      // setup stubs
      let getConsumerStub = sandbox.stub().returns(P.resolve())
      getConsumerStub.onCall(0).throws('Error!')
      ConsumerStub = {
        getConsumer: getConsumerStub
      }
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      await KafkaCron.start('position')
      test.ok(RegisterHandlersStub.positions.registerPositionHandlers.callCount === 1)
      test.end()
    })

    cronTest.test(`do nothing when an invalid DOA data set for prepare handlerType`, async (test) => {
      // setup stubs
      DAOStub = {
        retrieveAllParticipants: sandbox.stub().throws('Stub Error!')
      }

      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        await KafkaCron.start('prepare')
        test.ok(RegisterHandlersStub.transfers.registerPrepareHandlers.callCount === (fspList.length * 0))
      } catch (err) {
        test.fail('Error NOT expected')
      }

      test.end()
    })

    cronTest.test(`do nothing when an exception is thrown by DOA for prepare handlerTyp`, async (test) => {
      // setup stubs
      DAOStub = {
        retrieveAllParticipants: sandbox.stub().returns(P.resolve([]))
      }

      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        await KafkaCron.start('prepare')
        test.ok(RegisterHandlersStub.transfers.registerPrepareHandlers.callCount === (fspList.length * 0))
      } catch (err) {
        test.fail('Error NOT expected')
      }

      test.end()
    })

    cronTest.test(`do nothing when an invalid DOA data set for position handlerType`, async (test) => {
      // setup stubs
      DAOStub = {
        retrieveAllParticipants: sandbox.stub().throws('Stub Error!')
      }

      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        await KafkaCron.start('position')
        test.ok(RegisterHandlersStub.positions.registerPositionHandlers.callCount === (fspList.length * 0))
      } catch (err) {
        test.fail('Error NOT expected')
      }

      test.end()
    })

    cronTest.test(`do nothing when an exception is thrown by DOA for position handlerTyp`, async (test) => {
      // setup stubs
      DAOStub = {
        retrieveAllParticipants: sandbox.stub().returns(P.resolve([]))
      }

      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        await KafkaCron.start('position')
        test.ok(RegisterHandlersStub.positions.registerPositionHandlers.callCount === (fspList.length * 0))
      } catch (err) {
        test.fail('Error NOT expected')
      }

      test.end()
    })

    cronTest.test(`throw an exception for an 'unknown' handlerType`, async (test) => {
      // setup stubs
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        await KafkaCron.start('unknown')
        test.fail('Error expected')
      } catch (err) {
        test.ok(err.message === 'lib.Kafka.Cron.registerNewHandlers - unable to start CronJob with handlerType: unknown')
      }

      test.end()
    })

    cronTest.test(`stop a handler if it already exists before starting it`, async (test) => {
      // setup stubs
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        await KafkaCron.start('prepare')
        await KafkaCron.start('prepare')
        test.ok(CronJobStubClassDestroySpy.calledOnce)
      } catch (err) {
        test.fail('Error NOT expected')
      }

      test.end()
    })

    cronTest.test(`do nothing when trying to stop a handler that does not exists`, async (test) => {
      // setup stubs
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        await KafkaCron.stop('prepare')
        test.ok(CronJobStubClassDestroySpy.callCount === 0)
      } catch (err) {
        test.fail('Error NOT expected')
      }

      test.end()
    })

    cronTest.test(`return true for isRunning`, async (test) => {
      // setup stubs
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        await KafkaCron.start('prepare')
        let result = await KafkaCron.isRunning('prepare')
        test.ok(result)
      } catch (err) {
        test.fail('Error NOT expected')
      }

      test.end()
    })

    cronTest.test(`return false for job does not exist`, async (test) => {
      // setup stubs
      KafkaCron = Proxyquire(`${src}/handlers/lib/kafka/cron`, {
        '../lib/config': Config,
        'cron': CronJobStub,
        '../../register': RegisterHandlersStub,
        '../dao': DAOStub,
        './consumer': ConsumerStub
      })

      try {
        let result = await KafkaCron.isRunning('prepare')
        test.ok(!result)
      } catch (err) {
        test.fail('Error NOT expected')
      }

      test.end()
    })

    cronTest.end()
  })

  setupTest.end()
})
