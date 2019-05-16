/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

const partyIdentifierType = [
  {
    'name': 'MSISDN',
    'description': 'An MSISDN (Mobile Station International Subscriber Directory Number; that is, a phone number) is used in reference to a Party'
  },
  {
    'name': 'EMAIL_NOT_SUPPORTED',
    'description': 'An email is used in reference to a Party. The format of the email should be according to the informational RFC 3696'
  },
  {
    'name': 'PERSONAL_ID_NOT_SUPPORTED',
    'description': 'A personal identifier is used in reference to a participant. Examples of personal identification are passport number, birth certificate number, and national registration number. The identifier number is added in the PartyIdentifier element. The personal identifier type is added in the PartySubIdOrType element'
  },
  {
    'name': 'BUSINESS_NOT_SUPPORTED',
    'description': 'A specific Business (for example, an organization or a company) is used in reference to a participant. The BUSINESS identifier can be in any format. To make a transaction connected to a specific username or bill number in a Business, the PartySubIdOrType element should be used'
  },
  {
    'name': 'DEVICE_NOT_SUPPORTED',
    'description': 'A specific device (for example, POS or ATM) ID connected to a specific business or organization is used in reference to a Party. For referencing a specific device under a specific business or organization, use the PartySubIdOrType element'
  },
  {
    'name': 'ACCOUNT_ID_NOT_SUPPORTED',
    'description': 'A bank account number or FSP account ID should be used in reference to a participant. The ACCOUNT_ID identifier can be in any format, as formats can greatly differ depending on country and FSP'
  },
  {
    'name': 'IBAN_NOT_SUPPORTED',
    'description': 'A bank account number or FSP account ID is used in reference to a participant. The IBAN identifier can consist of up to 34 alphanumeric characters and should be entered without whitespace'
  },
  {
    'name': 'ALIAS_NOT_SUPPORTED',
    'description': 'An alias is used in reference to a participant. The alias should be created in the FSP as an alternative reference to an account owner. Another example of an alias is a username in the FSP system. The ALIAS identifier can be in any format. It is also possible to use the PartySubIdOrType element for identifying an account under an Alias defined by the PartyIdentifier'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('partyIdentifierType').insert(partyIdentifierType)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for partyIdentifierType has failed with the following error: ${err}`)
      return -1000
    }
  }
}
