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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const currencies = [
  { currencyId: 'AED', scale: 2, name: 'UAE dirham' },
  { currencyId: 'AFA', scale: 4, name: 'Afghanistan afghani (obsolete)' },
  { currencyId: 'AFN', scale: 2, name: 'Afghanistan afghani' },
  { currencyId: 'ALL', scale: 2, name: 'Albanian lek' },
  { currencyId: 'AMD', scale: 2, name: 'Armenian dram' },
  { currencyId: 'ANG', scale: 2, name: 'Netherlands Antillian guilder' },
  { currencyId: 'AOA', scale: 2, name: 'Angolan kwanza' },
  { currencyId: 'AOR', scale: 4, name: 'Angolan kwanza reajustado' },
  { currencyId: 'ARS', scale: 2, name: 'Argentine peso' },
  { currencyId: 'AUD', scale: 2, name: 'Australian dollar' },
  { currencyId: 'AWG', scale: 2, name: 'Aruban guilder' },
  { currencyId: 'AZN', scale: 2, name: 'Azerbaijanian new manat' },
  { currencyId: 'BAM', scale: 2, name: 'Bosnia-Herzegovina convertible mark' },
  { currencyId: 'BBD', scale: 2, name: 'Barbados dollar' },
  { currencyId: 'BDT', scale: 2, name: 'Bangladeshi taka' },
  { currencyId: 'BGN', scale: 2, name: 'Bulgarian lev' },
  { currencyId: 'BHD', scale: 3, name: 'Bahraini dinar' },
  { currencyId: 'BIF', scale: 0, name: 'Burundi franc' },
  { currencyId: 'BMD', scale: 2, name: 'Bermudian dollar' },
  { currencyId: 'BND', scale: 2, name: 'Brunei dollar' },
  { currencyId: 'BOB', scale: 2, name: 'Bolivian boliviano' },
  { currencyId: 'BOV', scale: 2, name: 'Bolivia Mvdol' },
  { currencyId: 'BRL', scale: 2, name: 'Brazilian real' },
  { currencyId: 'BSD', scale: 2, name: 'Bahamian dollar' },
  { currencyId: 'BTN', scale: 2, name: 'Bhutan ngultrum' },
  { currencyId: 'BWP', scale: 2, name: 'Botswana pula' },
  { currencyId: 'BYN', scale: 4, name: 'Belarusian ruble' },
  { currencyId: 'BYR', scale: 0, name: 'Belarussian Ruble' },
  { currencyId: 'BZD', scale: 2, name: 'Belize dollar' },
  { currencyId: 'CAD', scale: 2, name: 'Canadian dollar' },
  { currencyId: 'CDF', scale: 2, name: 'Congolese franc' },
  { currencyId: 'CHE', scale: 2, name: 'Switzerland WIR Euro' },
  { currencyId: 'CHF', scale: 2, name: 'Swiss franc' },
  { currencyId: 'CHW', scale: 2, name: 'Switzerland WIR Franc' },
  { currencyId: 'CLF', scale: 4, name: 'Unidad de Fomento' },
  { currencyId: 'CLP', scale: 0, name: 'Chilean peso' },
  { currencyId: 'CNY', scale: 2, name: 'Chinese yuan renminbi' },
  { currencyId: 'COP', scale: 2, name: 'Colombian peso' },
  { currencyId: 'COU', scale: 2, name: 'Unidad de Valor Real' },
  { currencyId: 'CRC', scale: 2, name: 'Costa Rican colon' },
  { currencyId: 'CUC', scale: 2, name: 'Cuban convertible peso' },
  { currencyId: 'CUP', scale: 2, name: 'Cuban peso' },
  { currencyId: 'CVE', scale: 2, name: 'Cape Verde escudo' },
  { currencyId: 'CZK', scale: 2, name: 'Czech koruna' },
  { currencyId: 'DJF', scale: 0, name: 'Djibouti franc' },
  { currencyId: 'DKK', scale: 2, name: 'Danish krone' },
  { currencyId: 'DOP', scale: 2, name: 'Dominican peso' },
  { currencyId: 'DZD', scale: 2, name: 'Algerian dinar' },
  { currencyId: 'EEK', scale: 4, name: 'Estonian kroon' },
  { currencyId: 'EGP', scale: 2, name: 'Egyptian pound' },
  { currencyId: 'ERN', scale: 2, name: 'Eritrean nakfa' },
  { currencyId: 'ETB', scale: 2, name: 'Ethiopian birr' },
  { currencyId: 'EUR', scale: 2, name: 'EU euro' },
  { currencyId: 'FJD', scale: 2, name: 'Fiji dollar' },
  { currencyId: 'FKP', scale: 2, name: 'Falkland Islands pound' },
  { currencyId: 'GBP', scale: 2, name: 'British pound' },
  { currencyId: 'GEL', scale: 2, name: 'Georgian lari' },
  { currencyId: 'GGP', scale: 4, name: 'Guernsey pound' },
  { currencyId: 'GHS', scale: 2, name: 'Ghanaian new cedi' },
  { currencyId: 'GIP', scale: 2, name: 'Gibraltar pound' },
  { currencyId: 'GMD', scale: 2, name: 'Gambian dalasi' },
  { currencyId: 'GNF', scale: 0, name: 'Guinean franc' },
  { currencyId: 'GTQ', scale: 2, name: 'Guatemalan quetzal' },
  { currencyId: 'GYD', scale: 2, name: 'Guyana dollar' },
  { currencyId: 'HKD', scale: 2, name: 'Hong Kong SAR dollar' },
  { currencyId: 'HNL', scale: 2, name: 'Honduran lempira' },
  { currencyId: 'HRK', scale: 2, name: 'Croatian kuna' },
  { currencyId: 'HTG', scale: 2, name: 'Haitian gourde' },
  { currencyId: 'HUF', scale: 2, name: 'Hungarian forint' },
  { currencyId: 'IDR', scale: 2, name: 'Indonesian rupiah' },
  { currencyId: 'ILS', scale: 2, name: 'Israeli new shekel' },
  { currencyId: 'IMP', scale: 4, name: 'Isle of Man pound' },
  { currencyId: 'INR', scale: 2, name: 'Indian rupee' },
  { currencyId: 'IQD', scale: 3, name: 'Iraqi dinar' },
  { currencyId: 'IRR', scale: 2, name: 'Iranian rial' },
  { currencyId: 'ISK', scale: 0, name: 'Icelandic krona' },
  { currencyId: 'JEP', scale: 4, name: 'Jersey pound' },
  { currencyId: 'JMD', scale: 2, name: 'Jamaican dollar' },
  { currencyId: 'JOD', scale: 3, name: 'Jordanian dinar' },
  { currencyId: 'JPY', scale: 0, name: 'Japanese yen' },
  { currencyId: 'KES', scale: 2, name: 'Kenyan shilling' },
  { currencyId: 'KGS', scale: 2, name: 'Kyrgyz som' },
  { currencyId: 'KHR', scale: 2, name: 'Cambodian riel' },
  { currencyId: 'KMF', scale: 0, name: 'Comoros franc' },
  { currencyId: 'KPW', scale: 2, name: 'North Korean won' },
  { currencyId: 'KRW', scale: 0, name: 'South Korean won' },
  { currencyId: 'KWD', scale: 3, name: 'Kuwaiti dinar' },
  { currencyId: 'KYD', scale: 2, name: 'Cayman Islands dollar' },
  { currencyId: 'KZT', scale: 2, name: 'Kazakh tenge' },
  { currencyId: 'LAK', scale: 2, name: 'Lao kip' },
  { currencyId: 'LBP', scale: 2, name: 'Lebanese pound' },
  { currencyId: 'LKR', scale: 2, name: 'Sri Lanka rupee' },
  { currencyId: 'LRD', scale: 2, name: 'Liberian dollar' },
  { currencyId: 'LSL', scale: 2, name: 'Lesotho loti' },
  { currencyId: 'LTL', scale: 4, name: 'Lithuanian litas' },
  { currencyId: 'LVL', scale: 4, name: 'Latvian lats' },
  { currencyId: 'LYD', scale: 3, name: 'Libyan dinar' },
  { currencyId: 'MAD', scale: 2, name: 'Moroccan dirham' },
  { currencyId: 'MDL', scale: 2, name: 'Moldovan leu' },
  { currencyId: 'MGA', scale: 2, name: 'Malagasy ariary' },
  { currencyId: 'MKD', scale: 2, name: 'Macedonian denar' },
  { currencyId: 'MMK', scale: 2, name: 'Myanmar kyat' },
  { currencyId: 'MNT', scale: 2, name: 'Mongolian tugrik' },
  { currencyId: 'MOP', scale: 2, name: 'Macao SAR pataca' },
  { currencyId: 'MRO', scale: 2, name: 'Mauritanian ouguiya' },
  { currencyId: 'MUR', scale: 2, name: 'Mauritius rupee' },
  { currencyId: 'MVR', scale: 2, name: 'Maldivian rufiyaa' },
  { currencyId: 'MWK', scale: 2, name: 'Malawi kwacha' },
  { currencyId: 'MXN', scale: 2, name: 'Mexican peso' },
  { currencyId: 'MXV', scale: 2, name: 'Mexican Unidad de Inversion (UDI)' },
  { currencyId: 'MYR', scale: 2, name: 'Malaysian ringgit' },
  { currencyId: 'MZN', scale: 2, name: 'Mozambique new metical' },
  { currencyId: 'NAD', scale: 2, name: 'Namibian dollar' },
  { currencyId: 'NGN', scale: 2, name: 'Nigerian naira' },
  { currencyId: 'NIO', scale: 2, name: 'Nicaraguan cordoba oro' },
  { currencyId: 'NOK', scale: 2, name: 'Norwegian krone' },
  { currencyId: 'NPR', scale: 2, name: 'Nepalese rupee' },
  { currencyId: 'NZD', scale: 2, name: 'New Zealand dollar' },
  { currencyId: 'OMR', scale: 3, name: 'Omani rial' },
  { currencyId: 'PAB', scale: 2, name: 'Panamanian balboa' },
  { currencyId: 'PEN', scale: 2, name: 'Peruvian nuevo sol' },
  { currencyId: 'PGK', scale: 2, name: 'Papua New Guinea kina' },
  { currencyId: 'PHP', scale: 2, name: 'Philippine peso' },
  { currencyId: 'PKR', scale: 2, name: 'Pakistani rupee' },
  { currencyId: 'PLN', scale: 2, name: 'Polish zloty' },
  { currencyId: 'PYG', scale: 0, name: 'Paraguayan guarani' },
  { currencyId: 'QAR', scale: 2, name: 'Qatari rial' },
  { currencyId: 'RON', scale: 2, name: 'Romanian new leu' },
  { currencyId: 'RSD', scale: 2, name: 'Serbian dinar' },
  { currencyId: 'RUB', scale: 2, name: 'Russian ruble' },
  { currencyId: 'RWF', scale: 0, name: 'Rwandan franc' },
  { currencyId: 'SAR', scale: 2, name: 'Saudi riyal' },
  { currencyId: 'SBD', scale: 2, name: 'Solomon Islands dollar' },
  { currencyId: 'SCR', scale: 2, name: 'Seychelles rupee' },
  { currencyId: 'SDG', scale: 2, name: 'Sudanese pound' },
  { currencyId: 'SEK', scale: 2, name: 'Swedish krona' },
  { currencyId: 'SGD', scale: 2, name: 'Singapore dollar' },
  { currencyId: 'SHP', scale: 2, name: 'Saint Helena pound' },
  { currencyId: 'SLL', scale: 2, name: 'Sierra Leone leone' },
  { currencyId: 'SOS', scale: 2, name: 'Somali shilling' },
  { currencyId: 'SPL', scale: 4, name: 'Seborgan luigino' },
  { currencyId: 'SRD', scale: 2, name: 'Suriname dollar' },
  { currencyId: 'SSP', scale: 2, name: 'South Sudanese Pound' },
  { currencyId: 'STD', scale: 2, name: 'Sao Tome and Principe dobra' },
  { currencyId: 'SVC', scale: 2, name: 'El Salvador colon' },
  { currencyId: 'SYP', scale: 2, name: 'Syrian pound' },
  { currencyId: 'SZL', scale: 2, name: 'Swaziland lilangeni' },
  { currencyId: 'THB', scale: 2, name: 'Thai baht' },
  { currencyId: 'TJS', scale: 2, name: 'Tajik somoni' },
  { currencyId: 'TMT', scale: 2, name: 'Turkmen new manat' },
  { currencyId: 'TND', scale: 3, name: 'Tunisian dinar' },
  { currencyId: 'TOP', scale: 2, name: 'Tongan pa\'anga' },
  { currencyId: 'TRY', scale: 2, name: 'Turkish lira' },
  { currencyId: 'TTD', scale: 2, name: 'Trinidad and Tobago dollar' },
  { currencyId: 'TVD', scale: 4, name: 'Tuvaluan dollar' },
  { currencyId: 'TWD', scale: 2, name: 'Taiwan New dollar' },
  { currencyId: 'TZS', scale: 2, name: 'Tanzanian shilling' },
  { currencyId: 'UAH', scale: 2, name: 'Ukrainian hryvnia' },
  { currencyId: 'UGX', scale: 0, name: 'Uganda new shilling' },
  { currencyId: 'USD', scale: 2, name: 'US dollar' },
  { currencyId: 'USN', scale: 2, name: 'US Dollar (Next day)' },
  { currencyId: 'UYI', scale: 0, name: 'Uruguay Peso en Unidades Indexadas (URUIURUI)' },
  { currencyId: 'UYU', scale: 2, name: 'Uruguayan peso uruguayo' },
  { currencyId: 'UZS', scale: 2, name: 'Uzbekistani sum' },
  { currencyId: 'VEF', scale: 2, name: 'Venezuelan bolivar fuerte' },
  { currencyId: 'VND', scale: 0, name: 'Vietnamese dong' },
  { currencyId: 'VUV', scale: 0, name: 'Vanuatu vatu' },
  { currencyId: 'WST', scale: 2, name: 'Samoan tala' },
  { currencyId: 'XAF', scale: 0, name: 'CFA franc BEAC' },
  { currencyId: 'XAG', scale: 4, name: 'Silver (ounce)' },
  { currencyId: 'XAU', scale: 4, name: 'Gold (ounce)' },
  { currencyId: 'XCD', scale: 2, name: 'East Caribbean dollar' },
  { currencyId: 'XDR', scale: 4, name: 'IMF special drawing right' },
  { currencyId: 'XFO', scale: 4, name: 'Gold franc' },
  { currencyId: 'XFU', scale: 4, name: 'UIC franc' },
  { currencyId: 'XOF', scale: 0, name: 'CFA franc BCEAO' },
  { currencyId: 'XPD', scale: 4, name: 'Palladium (ounce)' },
  { currencyId: 'XPF', scale: 0, name: 'CFP franc' },
  { currencyId: 'XPT', scale: 4, name: 'Platinum (ounce)' },
  { currencyId: 'XSU', scale: 4, name: 'Sucre' },
  { currencyId: 'XTS', scale: 4, name: 'Reserved for testing purposes' },
  { currencyId: 'XUA', scale: 4, name: 'African Development Bank (ADB) Unit of Account' },
  { currencyId: 'XXX', scale: 4, name: 'Assigned for transactions where no currency is involved' },
  { currencyId: 'YER', scale: 2, name: 'Yemeni rial' },
  { currencyId: 'ZAR', scale: 2, name: 'South African rand' },
  { currencyId: 'ZMK', scale: 4, name: 'Zambian kwacha (obsolete)' },
  { currencyId: 'ZMW', scale: 2, name: 'Zambian kwacha' },
  { currencyId: 'ZWD', scale: 4, name: 'Zimbabwe dollar (initial)' },
  { currencyId: 'ZWL', scale: 2, name: 'Zimbabwe dollar (3rd denomination)' },
  { currencyId: 'ZWN', scale: 4, name: 'Zimbabwe dollar (1st denomination)' },
  { currencyId: 'ZWR', scale: 4, name: 'Zimbabwe dollar (2nd denomination)' }
]

const currencyList = currencies.map(currentValue => {
  return currentValue.currencyId
}).sort()

const seed = async function (knex) {
  try {
    return await knex('currency').insert(currencies).onConflict('currencyId').ignore()
  } catch (err) {
    console.log(`Uploading seeds for currency has failed with the following error: ${err}`)
    return -1000
  }
}

module.exports = {
  currencyList,
  seed
}
