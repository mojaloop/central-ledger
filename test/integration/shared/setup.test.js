const Test = require('tape')
const { assert } = require('sinon')


const Logger = require('@mojaloop/central-services-logger')
const { _connectMongoose } = require('../../../src/shared/setup')

Test('setup', async setupTest => {

  await setupTest.test('connectMongoose', async connectMongooseTest => {
    await connectMongooseTest.test('it connects to mongoose without any extra parameters',
    async assert => {
      const config = {
        MONGODB_URI: 'mongodb://objstore:27017/test',
        MONGODB_DISABLED: false,
        MONGODB_OPTIONS: { }
      }

      let mongoose
      try {
        mongoose = await _connectMongoose(config)
        assert.pass('connectMongooseTest pass')
        assert.end()
      } catch (err) {
        Logger.error(`connectMongooseTest failed - ${err}`)
        assert.pass('connectMongooseTest failed')
        assert.end()
      } finally {
        if (mongoose) {
          mongoose.disconnect()
        }
      }
    })

    await connectMongooseTest.test('it connects to mongoose with ssl',
    async assert => {
      const config = {
        MONGODB_URI: 'mongodb://objstore:27017/test',
        MONGODB_DISABLED: false,
        MONGODB_OPTIONS: {
          ssl: true,
          sslValidate: false,
        }
      }

      let mongoose
      try {
        mongoose = await _connectMongoose(config)
        assert.pass('connectMongooseTest pass')
        assert.end()
      } catch (err) {
        Logger.error(`connectMongooseTest failed - ${err}`)
        assert.fail(`connectMongooseTest failed - ${err}`)
        assert.end()
      } finally { 
        if (mongoose) {
          mongoose.disconnect()
        }
      }
    })

    await connectMongooseTest.test('it does not connect if MONGODB_DISABLED is `true`',
    async assert => {
      const config = {
        MONGODB_URI: 'mongodb://objstore:27017/test',
        MONGODB_DISABLED: true,
      }

      let notMongoose
      try {
        // _connectMongoose should return null here.
        notMongoose = await _connectMongoose(config)
        assert.equal(notMongoose, null, 'mongoose connection was made when `MONGODB_DISABLED = true`')
        assert.end()
      } catch (err) {
        Logger.error(`connectMongooseTest failed - ${err}`)
        assert.fail(`connectMongooseTest failed - ${err}`)
        assert.end()
      }
    })

    console.log('connectMongooseTest done')
    connectMongooseTest.end()
  })

  setupTest.end()
})  