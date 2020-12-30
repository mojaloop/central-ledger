const Test = require('tapes')(require('tape'))
// let app = require('./app')
const Db = require('../../src/lib/db')

var supertest = require('supertest')
let request
Test('setup', async setupTest => {
  // setupTest.plan(1)
  const app = await require('../../src/api/index')
  request = supertest.agent(app.listener)

  await setupTest.test('setup handlers', async (test) => {
    // const knex = await Db.getKnex()

    const knex = await Db.getKnex()
    await knex('participantPosition').where('changedDate', '>', '2020-07-27').del()
    await knex('participantCurrency').where('createdDate', '>', '2020-07-27').del()
    await Db.ledgerAccountType.destroy({
      name: 'testAccount2'
    })
    const res = await request.get('/participants')
    console.log('Existing Participants', res)
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
    let resp = await request.get('/participants')
    console.log('particpants2', JSON.stringify(resp.body))
    resp = await request.get('/ledgerAccountTypes')
    console.log('ledgerAccountTypes', JSON.stringify(resp.body))

    console.log('OK')
    test.pass('done')
    test.end()
    console.log('END')
  })
  console.log('ENDING')
  await setupTest.end()
})
