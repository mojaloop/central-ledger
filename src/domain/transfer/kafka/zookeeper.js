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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

const Logger = require('@mojaloop/central-services-shared').Logger
var zookeeper = require('node-zookeeper-client')

const getListOfTopics = (host, retries = 2) => {
  return new Promise((resolve, reject) => {
    var path = '/brokers/topics'
    var client = zookeeper.createClient(host, { retries: retries })
    function listChildren (client, path) {
      client.getChildren(
        path,
        function (event) {
          Logger.debug('Zookeeper.getListOfTopics:: Got watcher event: %s', event)
          listChildren(client, path)
        },
        function (error, children, stat) {
          if (error) {
            Logger.error(
              'Zookeeper.getListOfTopics:: Failed to list children of node: %s due to: %s.',
              path,
              error
            )
            client.close()
            return reject(error)
          }

          Logger.debug('Zookeeper.getListOfTopics:: Children of node: %s are: %j.', path, children)
          client.close()
          return resolve(children)
        }
      )
    }
    client.once('connected', function () {
      Logger.debug('Zookeeper.getListOfTopics:: Connected to ZooKeeper on %s', host)
      listChildren(client, path)
    })
    client.connect()
  })
}

exports.getListOfTopics = getListOfTopics
