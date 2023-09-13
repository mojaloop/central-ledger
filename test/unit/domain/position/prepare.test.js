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

 * Kevin Leyow <kevin.leyow@infitx.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const Sinon = require('sinon')
const { processPositionPrepareBin } = require('../../../../src/domain/position/prepare')
const Logger = require('@mojaloop/central-services-logger')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const SettlementModelCached = require('../../../../src/models/settlement/settlementModelCached')
const BatchModel = require('../../../../src/models/position/batch')

const payerFsp = 'perffsp1'
const currency = 'USD'
// Each transfer is for $2.00 USD
const transferMessage1 = {
  value: {
    from: 'perffsp1',
    to: 'perffsp2',
    id: '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf',
    content: {
      uriParams: {
        id: '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf'
      },
      headers: {
        host: 'ml-api-adapter:3000',
        'content-length': 1314,
        accept: 'application/vnd.interoperability.transfers+json;version=1.1',
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
        date: '2023-08-17T15:25:08.000Z',
        'fspiop-destination': 'perffsp2',
        'fspiop-source': 'perffsp1',
        traceparent: '00-e11ece8cc6ca3dc170a8ab693910d934-25d85755f1bc6898-01',
        tracestate: 'tx_end2end_start_ts=1692285908510'
      },
      payload: 'data:application/vnd.interoperability.transfers+json;version=1.1;base64,eyJ0cmFuc2ZlcklkIjoiMWNmNjk4MWItMjVkOC00YmQ3LWI5ZDktYjFjMGZjOGNkZWFmIiwicGF5ZXJGc3AiOiJwZXJmZnNwMSIsInBheWVlRnNwIjoicGVyZmZzcDIiLCJhbW91bnQiOnsiYW1vdW50IjoiMiIsImN1cnJlbmN5IjoiVVNEIn0sImV4cGlyYXRpb24iOiIyMDMwLTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJpbHBQYWNrZXQiOiJBWUlER1FBQUFBQUFBQ2NRSVdjdVozSmxaVzVpWVc1clpuTndMbTF6YVhOa2JpNHlOemN4TXpnd016a3hNb0lDNjJWNVNqQmpiVVoxWXpKR2FtUkhiSFppYTJ4clNXcHZhVTFFUlhoYVIxRXlUbGRaZEU1VVFYcE5lVEF3VFZkTk1reFVhekZhUjFsMFQxUkZlRmw2V1RSUFZGRXhXV3BvYlVscGQybGpXRloyWkVkV1NscERTVFpKYlZGM1RYcEpNVTFFVlRKTVZFMHhUbGRGZEU1RVVteE5VekZwVDFSbk1FeFhXWGRaVkZFeFRtcEZNRmt5UlhwUFEwbHpTVzVDYUdWWFZteEphbkEzU1c1Q2FHTnVValZUVjFKS1ltMWFka2xxY0RkSmJrSm9ZMjVTTlZOWFVsVmxXRUpzU1dwdmFWUldUa3BWTUZKUFNXbDNhV05IUm5sa1NHeEtXa2RXZFdSSGJHMWhWMVo1U1dwdmFVMXFZek5OVkUwMFRVUk5OVTFVU1dsTVEwcHRZek5DU2xwRFNUWkpiV1I1V2xkV2RWbHRSblZoTWxwNlkwTktPV1pUZDJsalIwWTFXbGhKYVU5dWMybGpSMFo1WkVoc1NscEZiSFZhYlRocFQyNXphV05IUm5sa1NHeEtXa1pTTldOSFZXbFBhVXBPVlRCc1ZGSkZOR2xNUTBwM1dWaEtNR1ZWYkd0YVZ6VXdZVmRhY0ZwWVNXbFBhVWt3VGtSRmVVMTZVVEZPYW1NMFQxTkpjMGx0V25walJXeHJTV3B2YVdOSGJIVmhNa3BvWW0xMGJXTXpRV2xtVTNkcFkwZFdlV015T1hWWlYzaEtZbTFhZGtscWNEZEpiVTUyWWxoQ2MxcFlhRTlaVnpGc1NXcHdOMGx0V25CamJrNHdWRzFHZEZwVFNUWkphMXB3WTI1T01HSnRSblJhVXpGVldsaE9NRWxwZDJsaVIwWjZaRVUxYUdKWFZXbFBhVXBOV1ZoT01HSnRSblJhVXpGVldsaE9NRWx1TUhOSmJWSm9aRWRXVUZwclNuQmpibEp2U1dwdmFVMVVhelJPUXpCM1RWTXdkMDFUU2psbVUzZHBXVmN4ZG1SWE5UQkphbkEzU1cxT01XTnVTbXhpYlU0MVNXcHZhVlpXVGtWSmFYZHBXVmN4ZG1SWE5UQkphbTlwVFZSQmQwbHVNSE5KYmxKNVdWYzFlbGxYVGpCaFZ6bDFWa2hzZDFwVFNUWmxlVXA2V1RKV2RWbFlTbkJpZVVrMlNXeFNVMUZWTlZSU2ExWlRTV2wzYVdGWE5YQmtSMnhvWkVjNWVVbHFiMmxWUlVaYVVsWkphVXhEU25CaWJXd3dZVmRHTUdJelNsVmxXRUpzU1dwdmFWRXdPVTlWTVZaT1VsWkphV1pZTUFBIiwiY29uZGl0aW9uIjoiNW0wZ3FfNWRMUWxUU1NSS1FtTHBqME1aMU10V0xXZ1N1MW9MR1ZUSnlZcyJ9'
    },
    type: 'application/json',
    metadata: {
      correlationId: '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf',
      event: {
        type: 'position',
        action: 'prepare',
        createdAt: '2023-08-17T15:25:08.511Z',
        state: {
          status: 'success',
          code: 0,
          description: 'action successful'
        },
        id: '790d84e4-912a-47dc-b1dd-2f2ac2989a9e'
      },
      trace: {
        service: 'cl_transfer_prepare',
        traceId: 'e11ece8cc6ca3dc170a8ab693910d934',
        spanId: '1a2c4baf99bdb2c6',
        sampled: 1,
        flags: '01',
        parentSpanId: '3c5863bb3c2b4ecc',
        startTimestamp: '2023-08-17T15:25:08.860Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiIxYTJjNGJhZjk5YmRiMmM2IiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4NTEwIn0=,tx_end2end_start_ts=1692285908510',
          transactionType: 'transfer',
          transactionAction: 'prepare',
          transactionId: '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf',
          source: 'perffsp1',
          destination: 'perffsp2',
          payerFsp: 'perffsp1',
          payeeFsp: 'perffsp2'
        },
        tracestates: {
          acmevendor: {
            spanId: '1a2c4baf99bdb2c6',
            timeApiPrepare: '1692285908510'
          },
          tx_end2end_start_ts: '1692285908510'
        }
      },
      'protocol.createdAt': 1692285908866
    }
  },
  size: 3489,
  key: 51,
  topic: 'topic-transfer-position',
  offset: 4070,
  partition: 0,
  timestamp: 1694175690401
}
const transferMessage2 = {
  value: {
    from: 'perffsp1',
    to: 'perffsp2',
    id: '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e',
    content: {
      uriParams: {
        id: '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e'
      },
      headers: {
        host: 'ml-api-adapter:3000',
        'user-agent': 'k6/0.45.0 (https://k6.io/)',
        'content-length': 1314,
        accept: 'application/vnd.interoperability.transfers+json;version=1.1',
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
        date: '2023-08-17T15:25:08.000Z',
        'fspiop-destination': 'perffsp2',
        'fspiop-source': 'perffsp1',
        traceparent: '00-3353dbcbb8f5a36cf4236873bf71fa00-cae41b1f121ab294-01',
        tracestate: 'tx_end2end_start_ts=1692285908887'
      },
      payload: 'data:application/vnd.interoperability.transfers+json;version=1.1;base64,eyJ0cmFuc2ZlcklkIjoiNmMyYzA5YzMtMTliNi00OGJhLWJlY2MtY2JkZmZjYWFkZDdlIiwicGF5ZXJGc3AiOiJwZXJmZnNwMSIsInBheWVlRnNwIjoicGVyZmZzcDIiLCJhbW91bnQiOnsiYW1vdW50IjoiMiIsImN1cnJlbmN5IjoiVVNEIn0sImV4cGlyYXRpb24iOiIyMDMwLTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJpbHBQYWNrZXQiOiJBWUlER1FBQUFBQUFBQ2NRSVdjdVozSmxaVzVpWVc1clpuTndMbTF6YVhOa2JpNHlOemN4TXpnd016a3hNb0lDNjJWNVNqQmpiVVoxWXpKR2FtUkhiSFppYTJ4clNXcHZhVTFFUlhoYVIxRXlUbGRaZEU1VVFYcE5lVEF3VFZkTk1reFVhekZhUjFsMFQxUkZlRmw2V1RSUFZGRXhXV3BvYlVscGQybGpXRloyWkVkV1NscERTVFpKYlZGM1RYcEpNVTFFVlRKTVZFMHhUbGRGZEU1RVVteE5VekZwVDFSbk1FeFhXWGRaVkZFeFRtcEZNRmt5UlhwUFEwbHpTVzVDYUdWWFZteEphbkEzU1c1Q2FHTnVValZUVjFKS1ltMWFka2xxY0RkSmJrSm9ZMjVTTlZOWFVsVmxXRUpzU1dwdmFWUldUa3BWTUZKUFNXbDNhV05IUm5sa1NHeEtXa2RXZFdSSGJHMWhWMVo1U1dwdmFVMXFZek5OVkUwMFRVUk5OVTFVU1dsTVEwcHRZek5DU2xwRFNUWkpiV1I1V2xkV2RWbHRSblZoTWxwNlkwTktPV1pUZDJsalIwWTFXbGhKYVU5dWMybGpSMFo1WkVoc1NscEZiSFZhYlRocFQyNXphV05IUm5sa1NHeEtXa1pTTldOSFZXbFBhVXBPVlRCc1ZGSkZOR2xNUTBwM1dWaEtNR1ZWYkd0YVZ6VXdZVmRhY0ZwWVNXbFBhVWt3VGtSRmVVMTZVVEZPYW1NMFQxTkpjMGx0V25walJXeHJTV3B2YVdOSGJIVmhNa3BvWW0xMGJXTXpRV2xtVTNkcFkwZFdlV015T1hWWlYzaEtZbTFhZGtscWNEZEpiVTUyWWxoQ2MxcFlhRTlaVnpGc1NXcHdOMGx0V25CamJrNHdWRzFHZEZwVFNUWkphMXB3WTI1T01HSnRSblJhVXpGVldsaE9NRWxwZDJsaVIwWjZaRVUxYUdKWFZXbFBhVXBOV1ZoT01HSnRSblJhVXpGVldsaE9NRWx1TUhOSmJWSm9aRWRXVUZwclNuQmpibEp2U1dwdmFVMVVhelJPUXpCM1RWTXdkMDFUU2psbVUzZHBXVmN4ZG1SWE5UQkphbkEzU1cxT01XTnVTbXhpYlU0MVNXcHZhVlpXVGtWSmFYZHBXVmN4ZG1SWE5UQkphbTlwVFZSQmQwbHVNSE5KYmxKNVdWYzFlbGxYVGpCaFZ6bDFWa2hzZDFwVFNUWmxlVXA2V1RKV2RWbFlTbkJpZVVrMlNXeFNVMUZWTlZSU2ExWlRTV2wzYVdGWE5YQmtSMnhvWkVjNWVVbHFiMmxWUlVaYVVsWkphVXhEU25CaWJXd3dZVmRHTUdJelNsVmxXRUpzU1dwdmFWRXdPVTlWTVZaT1VsWkphV1pZTUFBIiwiY29uZGl0aW9uIjoiNW0wZ3FfNWRMUWxUU1NSS1FtTHBqME1aMU10V0xXZ1N1MW9MR1ZUSnlZcyJ9'
    },
    type: 'application/json',
    metadata: {
      correlationId: '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e',
      event: {
        type: 'position',
        action: 'prepare',
        createdAt: '2023-08-17T15:25:08.888Z',
        state: {
          status: 'success',
          code: 0,
          description: 'action successful'
        },
        id: 'ed2e00ed-2b65-4f6a-886d-df9591c9df1f'
      },
      trace: {
        service: 'cl_transfer_prepare',
        traceId: '3353dbcbb8f5a36cf4236873bf71fa00',
        spanId: '95f51fddcfd3895b',
        sampled: 1,
        flags: '01',
        parentSpanId: '1e916a41afd771c7',
        startTimestamp: '2023-08-17T15:25:08.951Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiI5NWY1MWZkZGNmZDM4OTViIiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4ODg4In0=,tx_end2end_start_ts=1692285908887',
          transactionType: 'transfer',
          transactionAction: 'prepare',
          transactionId: '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e',
          source: 'perffsp1',
          destination: 'perffsp2',
          payerFsp: 'perffsp1',
          payeeFsp: 'perffsp2'
        },
        tracestates: {
          acmevendor: {
            spanId: '95f51fddcfd3895b',
            timeApiPrepare: '1692285908888'
          },
          tx_end2end_start_ts: '1692285908887'
        }
      },
      'protocol.createdAt': 1692285908957
    }
  },
  size: 3489,
  key: 51,
  topic: 'topic-transfer-position',
  offset: 4073,
  partition: 0,
  timestamp: 1694175690401
}
const transferMessage3 = {
  value: {
    from: 'perffsp1',
    to: 'perffsp2',
    id: '5dff336f-62c0-4619-92c6-9ccd7c8f0369',
    content: {
      uriParams: {
        id: '5dff336f-62c0-4619-92c6-9ccd7c8f0369'
      },
      headers: {
        host: 'ml-api-adapter:3000',
        'user-agent': 'k6/0.45.0 (https://k6.io/)',
        'content-length': 1314,
        accept: 'application/vnd.interoperability.transfers+json;version=1.1',
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
        date: '2023-08-17T15:25:08.000Z',
        'fspiop-destination': 'perffsp2',
        'fspiop-source': 'perffsp1',
        traceparent: '00-7295d8d6f6aed39e143fcbfcd5bf89b2-ecdb5940d1b8ec45-01',
        tracestate: 'tx_end2end_start_ts=1692285908467'
      },
      payload: 'data:application/vnd.interoperability.transfers+json;version=1.1;base64,eyJ0cmFuc2ZlcklkIjoiNWRmZjMzNmYtNjJjMC00NjE5LTkyYzYtOWNjZDdjOGYwMzY5IiwicGF5ZXJGc3AiOiJwZXJmZnNwMSIsInBheWVlRnNwIjoicGVyZmZzcDIiLCJhbW91bnQiOnsiYW1vdW50IjoiMiIsImN1cnJlbmN5IjoiVVNEIn0sImV4cGlyYXRpb24iOiIyMDMwLTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJpbHBQYWNrZXQiOiJBWUlER1FBQUFBQUFBQ2NRSVdjdVozSmxaVzVpWVc1clpuTndMbTF6YVhOa2JpNHlOemN4TXpnd016a3hNb0lDNjJWNVNqQmpiVVoxWXpKR2FtUkhiSFppYTJ4clNXcHZhVTFFUlhoYVIxRXlUbGRaZEU1VVFYcE5lVEF3VFZkTk1reFVhekZhUjFsMFQxUkZlRmw2V1RSUFZGRXhXV3BvYlVscGQybGpXRloyWkVkV1NscERTVFpKYlZGM1RYcEpNVTFFVlRKTVZFMHhUbGRGZEU1RVVteE5VekZwVDFSbk1FeFhXWGRaVkZFeFRtcEZNRmt5UlhwUFEwbHpTVzVDYUdWWFZteEphbkEzU1c1Q2FHTnVValZUVjFKS1ltMWFka2xxY0RkSmJrSm9ZMjVTTlZOWFVsVmxXRUpzU1dwdmFWUldUa3BWTUZKUFNXbDNhV05IUm5sa1NHeEtXa2RXZFdSSGJHMWhWMVo1U1dwdmFVMXFZek5OVkUwMFRVUk5OVTFVU1dsTVEwcHRZek5DU2xwRFNUWkpiV1I1V2xkV2RWbHRSblZoTWxwNlkwTktPV1pUZDJsalIwWTFXbGhKYVU5dWMybGpSMFo1WkVoc1NscEZiSFZhYlRocFQyNXphV05IUm5sa1NHeEtXa1pTTldOSFZXbFBhVXBPVlRCc1ZGSkZOR2xNUTBwM1dWaEtNR1ZWYkd0YVZ6VXdZVmRhY0ZwWVNXbFBhVWt3VGtSRmVVMTZVVEZPYW1NMFQxTkpjMGx0V25walJXeHJTV3B2YVdOSGJIVmhNa3BvWW0xMGJXTXpRV2xtVTNkcFkwZFdlV015T1hWWlYzaEtZbTFhZGtscWNEZEpiVTUyWWxoQ2MxcFlhRTlaVnpGc1NXcHdOMGx0V25CamJrNHdWRzFHZEZwVFNUWkphMXB3WTI1T01HSnRSblJhVXpGVldsaE9NRWxwZDJsaVIwWjZaRVUxYUdKWFZXbFBhVXBOV1ZoT01HSnRSblJhVXpGVldsaE9NRWx1TUhOSmJWSm9aRWRXVUZwclNuQmpibEp2U1dwdmFVMVVhelJPUXpCM1RWTXdkMDFUU2psbVUzZHBXVmN4ZG1SWE5UQkphbkEzU1cxT01XTnVTbXhpYlU0MVNXcHZhVlpXVGtWSmFYZHBXVmN4ZG1SWE5UQkphbTlwVFZSQmQwbHVNSE5KYmxKNVdWYzFlbGxYVGpCaFZ6bDFWa2hzZDFwVFNUWmxlVXA2V1RKV2RWbFlTbkJpZVVrMlNXeFNVMUZWTlZSU2ExWlRTV2wzYVdGWE5YQmtSMnhvWkVjNWVVbHFiMmxWUlVaYVVsWkphVXhEU25CaWJXd3dZVmRHTUdJelNsVmxXRUpzU1dwdmFWRXdPVTlWTVZaT1VsWkphV1pZTUFBIiwiY29uZGl0aW9uIjoiNW0wZ3FfNWRMUWxUU1NSS1FtTHBqME1aMU10V0xXZ1N1MW9MR1ZUSnlZcyJ9'
    },
    type: 'application/json',
    metadata: {
      correlationId: '5dff336f-62c0-4619-92c6-9ccd7c8f0369',
      event: {
        type: 'position',
        action: 'prepare',
        createdAt: '2023-08-17T15:25:08.468Z',
        state: {
          status: 'success',
          code: 0,
          description: 'action successful'
        },
        id: '7c9eeb85-4fab-4dbd-8a16-0f870f3efbe3'
      },
      trace: {
        service: 'cl_transfer_prepare',
        traceId: '7295d8d6f6aed39e143fcbfcd5bf89b2',
        spanId: '31ac97084059ed78',
        sampled: 1,
        flags: '01',
        parentSpanId: '87647df7326a1b6d',
        startTimestamp: '2023-08-17T15:25:08.732Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiIzMWFjOTcwODQwNTllZDc4IiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4NDY4In0=,tx_end2end_start_ts=1692285908467',
          transactionType: 'transfer',
          transactionAction: 'prepare',
          transactionId: '5dff336f-62c0-4619-92c6-9ccd7c8f0369',
          source: 'perffsp1',
          destination: 'perffsp2',
          payerFsp: 'perffsp1',
          payeeFsp: 'perffsp2'
        },
        tracestates: {
          acmevendor: {
            spanId: '31ac97084059ed78',
            timeApiPrepare: '1692285908468'
          },
          tx_end2end_start_ts: '1692285908467'
        }
      },
      'protocol.createdAt': 1692285908736
    }
  },
  size: 3489,
  key: 51,
  topic: 'topic-transfer-position',
  offset: 4076,
  partition: 0,
  timestamp: 1694175690401
}
const span = {}
const binItems = [{ message: transferMessage1, span }, { message: transferMessage2, span }, { message: transferMessage3, span }]

Test('Prepare domain', positionIndexTest => {
  let sandbox

  positionIndexTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ParticipantFacade, 'getByNameAndCurrency')
    sandbox.stub(ParticipantFacade, 'getParticipantLimitByParticipantCurrencyLimit')
    sandbox.stub(SettlementModelCached, 'getAll')
    sandbox.stub(BatchModel, 'getPositionsByAccountIdsNonTrx')
    t.end()
  })

  positionIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  positionIndexTest.test('processPositionPrepareBin should', changeParticipantPositionTest => {
    changeParticipantPositionTest.test('produce abort message for transfers not in the right transfer state', async (test) => {
      const participant = {
        participantId: 0,
        name: 'perffsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 0,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2, // 1 Immediate, 2 Deferred
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.withArgs(0, 'USD').returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.withArgs([2]).returns({
        1: 0, // perffsp1 position for position account
        2: 0 // perffsp1 position for settlement account
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        -10, // Accumulated position value should cover $4 in transfers
        0,
        {
          '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '5dff336f-62c0-4619-92c6-9ccd7c8f0369': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)
      test.equal(processedMessages.notifyMessages[0].message.content.uriParams.id, '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf')
      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Destination'], 'perffsp2')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Source'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedTransferStates[transferMessage1.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[1].message.content.uriParams.id, '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e')
      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Destination'], 'perffsp2')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Source'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedTransferStates[transferMessage2.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, '5dff336f-62c0-4619-92c6-9ccd7c8f0369')
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Destination'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedTransferStates[transferMessage3.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.value.id)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPositionValue, 6)
      test.end()
    })

    changeParticipantPositionTest.test('produce abort message for when payer does not have enough liquidity', async (test) => {
      const participant = {
        participantId: 0,
        name: 'perffsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 0, // Set low
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2, // 1 Immediate, 2 Deferred
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.withArgs(0, 'USD').returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 0, // perffsp1 position for position account
        2: 0 // perffsp1 position for settelement account
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        0, // No accumulated position value
        0,
        {
          '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '5dff336f-62c0-4619-92c6-9ccd7c8f0369': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)
      test.equal(processedMessages.notifyMessages[0].message.content.uriParams.id, '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf')
      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Destination'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[0].message.content.payload.errorInformation.errorCode, '4001')
      test.equal(processedMessages.notifyMessages[0].message.content.payload.errorInformation.errorDescription, 'Payer FSP insufficient liquidity')
      test.equal(processedMessages.accumulatedPositionChanges[0].value, 0)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage1.value.id], Enum.Transfers.TransferState.ABORTED)

      test.equal(processedMessages.notifyMessages[1].message.content.uriParams.id, '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e')
      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Destination'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[1].message.content.payload.errorInformation.errorCode, '4001')
      test.equal(processedMessages.notifyMessages[1].message.content.payload.errorInformation.errorDescription, 'Payer FSP insufficient liquidity')
      test.equal(processedMessages.accumulatedPositionChanges[1].value, 0)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage2.value.id], Enum.Transfers.TransferState.ABORTED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, '5dff336f-62c0-4619-92c6-9ccd7c8f0369')
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Destination'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedPositionChanges[2].value, 0)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage3.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.value.id)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.ABORTED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.ABORTED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPositionValue, 0)
      test.end()
    })

    changeParticipantPositionTest.test('produce reserved messages for valid transfer messages', async (test) => {
      const participant = {
        participantId: 0,
        name: 'perffsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2, // 1 Immediate, 2 Deferred
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.withArgs(0, 'USD').returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 100000,
        2: 100000
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        0,
        0,
        {
          '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '5dff336f-62c0-4619-92c6-9ccd7c8f0369': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)

      test.equal(processedMessages.notifyMessages[0].message.content.uriParams.id, '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf')
      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Destination'], 'perffsp2')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Source'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedPositionChanges[0].value, 9998)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage1.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[1].message.content.uriParams.id, '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e')
      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Destination'], 'perffsp2')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Source'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedPositionChanges[1].value, 9996)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage2.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, '5dff336f-62c0-4619-92c6-9ccd7c8f0369')
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Destination'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedPositionChanges[2].value, 9996)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage3.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.value.id)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPositionValue, 9996)
      test.end()
    })

    changeParticipantPositionTest.test('include settlementParticipantPosition in availablePosition calc when settlement model delay is IMMEDIATE', async (test) => {
      const participant = {
        participantId: 0,
        name: 'perffsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 1, // 1 Immediate, 2 Deferred
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.withArgs(0, 'USD').returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 100000,
        2: 100000
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        0,
        0,
        {
          '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '5dff336f-62c0-4619-92c6-9ccd7c8f0369': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)

      test.equal(processedMessages.notifyMessages[0].message.content.uriParams.id, '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf')
      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Destination'], 'perffsp2')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Source'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedPositionChanges[0].value, 109998)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage1.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[1].message.content.uriParams.id, '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e')
      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Destination'], 'perffsp2')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Source'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedPositionChanges[1].value, 109996)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage2.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, '5dff336f-62c0-4619-92c6-9ccd7c8f0369')
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Destination'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedPositionChanges[2].value, 109996)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage3.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.value.id)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPositionValue, 109996)
      test.end()
    })

    changeParticipantPositionTest.test('produce error if no settlement models found', async (test) => {
      const participant = {
        participantId: 0,
        name: 'perffsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const allSettlementModels = []

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.withArgs(0, 'USD').returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 100000,
        2: 100000
      })
      try {
        await processPositionPrepareBin(
          binItems,
          0,
          0,
          {
            '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
            '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
            '5dff336f-62c0-4619-92c6-9ccd7c8f0369': 'INVALID_STATE'
          }
        )
        test.notOk('Should throw error')
      } catch (error) {
        test.ok(error)
      }

      test.end()
    })

    changeParticipantPositionTest.test('produce reserved messages for valid transfer messages with default settlement model', async (test) => {
      const participant = {
        participantId: 0,
        name: 'perffsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2, // 1 Immediate, 2 Deferred
        currencyId: null, // Default settlement model is null currencyId
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.withArgs(0, 'USD').returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 100000,
        2: 100000
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        0,
        0,
        {
          '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          '5dff336f-62c0-4619-92c6-9ccd7c8f0369': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)

      test.equal(processedMessages.notifyMessages[0].message.content.uriParams.id, '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf')
      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Destination'], 'perffsp2')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['FSPIOP-Source'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedPositionChanges[0].value, 9998)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage1.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[1].message.content.uriParams.id, '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e')
      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Destination'], 'perffsp2')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['FSPIOP-Source'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedPositionChanges[1].value, 9996)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage2.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, '5dff336f-62c0-4619-92c6-9ccd7c8f0369')
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Destination'], 'perffsp1')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.notifyMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedPositionChanges[2].value, 9996)
      test.equal(processedMessages.accumulatedTransferStates[transferMessage3.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.value.id)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPositionValue, 9996)
      test.end()
    })

    changeParticipantPositionTest.skip('produce proper limit alarms', async (test) => {
    })

    changeParticipantPositionTest.end()
  })

  positionIndexTest.end()
})