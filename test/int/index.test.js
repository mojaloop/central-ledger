const Test = require('tapes')(require('tape'))
// let app = require('./app')
const Db = require('../../src/lib/db')

var supertest = require('supertest')

Test('setup', async setupTest => {
  // setupTest.plan(1)
  let app = await require('../../src/api/index')
  request = supertest.agent(app.listener)

  await setupTest.test('setup handlers', async (test) => {
    // const knex = await Db.getKnex()
    await Db.ledgerAccountType.destroy({
      name: 'testAccount2'
    })

    const result = await request.post(
      '/ledgerAccountTypes'
    ).send({
      name: 'testAccount2',
      description: 'test ledger',
      isActive: true,
      isSettleable: true
    })
    .set('Accept', 'application/json')

    console.log(result.body)
    console.log('OK')
    test.pass('done')
    test.end()
    console.log('END')
  })
  console.log('ENDING')
  await setupTest.end()

})
