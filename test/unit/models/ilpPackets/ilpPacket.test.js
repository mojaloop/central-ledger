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

 * ModusBox
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const IlpPacketsModel = require('../../../../src/models/ilpPackets/ilpPacket')

Test('IlpPackets', async (IlpPacketsTest) => {
  let sandbox

  IlpPacketsTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.ilpPacket = {
      find: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  IlpPacketsTest.afterEach(t => {
    sandbox.restore()

    t.end()
  })

  await IlpPacketsTest.test('get IlpPackets with transferId', async (assert) => {
    try {
      Db.ilpPacket.find.withArgs({ transferId: '6d3e964e-9a25-4ff5-a365-2cc5af348321' }).returns([
        {
          transferId: '6d3e964e-9a25-4ff5-a365-2cc5af348321',
          value: 'AYIC-AAAAAAAAeIfHWcucGF5ZWVmc3AubXNpc2RuLjIyNTU2OTk5MTI1ggLOZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTlRWa09ESXdObVV0T0RCaU55MDBPR00wTFRrNU5HTXRaREEyTmpRd01XRXdZbU00SWl3aWNYVnZkR1ZKWkNJNklqRmtPVGhpTkdReExXWmpOVFV0TkRaa09DMDROV1EyTFRnNVl6TXdZMkZoWWpRME5pSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTWpJMU5UWTVPVGt4TWpVaUxDSm1jM0JKWkNJNkluQmhlV1ZsWm5Od0luMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpJeU5UQTNNREE0TVRneElpd2labk53U1dRaU9pSndZWGxsY21aemNDSjlMQ0p3WlhKemIyNWhiRWx1Wm04aU9uc2lZMjl0Y0d4bGVFNWhiV1VpT25zaVptbHljM1JPWVcxbElqb2lUV0YwY3lJc0lteGhjM1JPWVcxbElqb2lTR0ZuYldGdUluMHNJbVJoZEdWUFprSnBjblJvSWpvaU1UazRNeTB4TUMweU5TSjlmU3dpWVcxdmRXNTBJanA3SW1OMWNuSmxibU41SWpvaVZWTkVJaXdpWVcxdmRXNTBJam94TWpNMExqSXpmU3dpZEhKaGJuTmhZM1JwYjI1VWVYQmxJanA3SW5OalpXNWhjbWx2SWpvaVZGSkJUbE5HUlZJaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkRUMDVUVlUxRlVpSjlmUQA',
          createdDate: '2020-05-23T17:31:29.000Z'
        }])
      const expected = [{
        transferId: '6d3e964e-9a25-4ff5-a365-2cc5af348321',
        value: 'AYIC-AAAAAAAAeIfHWcucGF5ZWVmc3AubXNpc2RuLjIyNTU2OTk5MTI1ggLOZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTlRWa09ESXdObVV0T0RCaU55MDBPR00wTFRrNU5HTXRaREEyTmpRd01XRXdZbU00SWl3aWNYVnZkR1ZKWkNJNklqRmtPVGhpTkdReExXWmpOVFV0TkRaa09DMDROV1EyTFRnNVl6TXdZMkZoWWpRME5pSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTWpJMU5UWTVPVGt4TWpVaUxDSm1jM0JKWkNJNkluQmhlV1ZsWm5Od0luMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpJeU5UQTNNREE0TVRneElpd2labk53U1dRaU9pSndZWGxsY21aemNDSjlMQ0p3WlhKemIyNWhiRWx1Wm04aU9uc2lZMjl0Y0d4bGVFNWhiV1VpT25zaVptbHljM1JPWVcxbElqb2lUV0YwY3lJc0lteGhjM1JPWVcxbElqb2lTR0ZuYldGdUluMHNJbVJoZEdWUFprSnBjblJvSWpvaU1UazRNeTB4TUMweU5TSjlmU3dpWVcxdmRXNTBJanA3SW1OMWNuSmxibU41SWpvaVZWTkVJaXdpWVcxdmRXNTBJam94TWpNMExqSXpmU3dpZEhKaGJuTmhZM1JwYjI1VWVYQmxJanA3SW5OalpXNWhjbWx2SWpvaVZGSkJUbE5HUlZJaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkRUMDVUVlUxRlVpSjlmUQA',
        createdDate: '2020-05-23T17:31:29.000Z'
      }]
      const result = await IlpPacketsModel.getById('6d3e964e-9a25-4ff5-a365-2cc5af348321')
      assert.deepEqual(JSON.stringify(result), JSON.stringify(expected))
      assert.end()
    } catch (err) {
      Logger.error(`get IlpPackets with transferId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await IlpPacketsTest.test('get IlpPackets with empty transferId', async (assert) => {
    Db.ilpPacket.find.withArgs().throws(new Error())
    try {
      await IlpPacketsModel.getById('')
      assert.fail(' should throws an error ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })
  await IlpPacketsTest.end()
})
