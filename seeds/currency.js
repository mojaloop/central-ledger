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
 --------------
 ******/

'use strict'

const currencies = [
  {
    'name': 'Afghanistan afghani (obsolete)',
    'currencyId': 'AFA'
  },
  {
    'name': 'Afghanistan afghani',
    'currencyId': 'AFN'
  },
  {
    'name': 'Algerian dinar',
    'currencyId': 'DZD'
  },
  {
    'name': 'Albanian lek',
    'currencyId': 'ALL'
  },
  {
    'name': 'Angolan kwanza',
    'currencyId': 'AOA'
  },
  {
    'name': 'Angolan kwanza reajustado',
    'currencyId': 'AOR'
  },
  {
    'name': 'Argentine peso',
    'currencyId': 'ARS'
  },
  {
    'name': 'Armenian dram',
    'currencyId': 'AMD'
  },
  {
    'name': 'Aruban guilder',
    'currencyId': 'AWG'
  },
  {
    'name': 'Australian dollar',
    'currencyId': 'AUD'
  },
  {
    'name': 'Azerbaijanian new manat',
    'currencyId': 'AZN'
  },
  {
    'name': 'Bahamian dollar',
    'currencyId': 'BSD'
  },
  {
    'name': 'Bahraini dinar',
    'currencyId': 'BHD'
  },
  {
    'name': 'Bangladeshi taka',
    'currencyId': 'BDT'
  },
  {
    'name': 'Barbados dollar',
    'currencyId': 'BBD'
  },
  {
    'name': 'Belarusian ruble',
    'currencyId': 'BYN'
  },
  {
    'name': 'Belize dollar',
    'currencyId': 'BZD'
  },
  {
    'name': 'Bermudian dollar',
    'currencyId': 'BMD'
  },
  {
    'name': 'Bhutan ngultrum',
    'currencyId': 'BTN'
  },
  {
    'name': 'Bolivian boliviano',
    'currencyId': 'BOB'
  },
  {
    'name': 'Bosnia-Herzegovina convertible mark',
    'currencyId': 'BAM'
  },
  {
    'name': 'Botswana pula',
    'currencyId': 'BWP'
  },
  {
    'name': 'Brazilian real',
    'currencyId': 'BRL'
  },
  {
    'name': 'British pound',
    'currencyId': 'GBP'
  },
  {
    'name': 'Brunei dollar',
    'currencyId': 'BND'
  },
  {
    'name': 'Bulgarian lev',
    'currencyId': 'BGN'
  },
  {
    'name': 'Burundi franc',
    'currencyId': 'BIF'
  },
  {
    'name': 'Cambodian riel',
    'currencyId': 'KHR'
  },
  {
    'name': 'Canadian dollar',
    'currencyId': 'CAD'
  },
  {
    'name': 'Cape Verde escudo',
    'currencyId': 'CVE'
  },
  {
    'name': 'Cayman Islands dollar',
    'currencyId': 'KYD'
  },
  {
    'name': 'CFA franc BCEAO',
    'currencyId': 'XOF'
  },
  {
    'name': 'CFA franc BEAC',
    'currencyId': 'XAF'
  },
  {
    'name': 'CFP franc',
    'currencyId': 'XPF'
  },
  {
    'name': 'Chilean peso',
    'currencyId': 'CLP'
  },
  {
    'name': 'Chinese yuan renminbi',
    'currencyId': 'CNY'
  },
  {
    'name': 'Colombian peso',
    'currencyId': 'COP'
  },
  {
    'name': 'Comoros franc',
    'currencyId': 'KMF'
  },
  {
    'name': 'Congolese franc',
    'currencyId': 'CDF'
  },
  {
    'name': 'Costa Rican colon',
    'currencyId': 'CRC'
  },
  {
    'name': 'Croatian kuna',
    'currencyId': 'HRK'
  },
  {
    'name': 'Cuban convertible peso',
    'currencyId': 'CUC'
  },
  {
    'name': 'Cuban peso',
    'currencyId': 'CUP'
  },
  {
    'name': 'Czech koruna',
    'currencyId': 'CZK'
  },
  {
    'name': 'Danish krone',
    'currencyId': 'DKK'
  },
  {
    'name': 'Djibouti franc',
    'currencyId': 'DJF'
  },
  {
    'name': 'Dominican peso',
    'currencyId': 'DOP'
  },
  {
    'name': 'East Caribbean dollar',
    'currencyId': 'XCD'
  },
  {
    'name': 'Egyptian pound',
    'currencyId': 'EGP'
  },
  {
    'name': 'El Salvador colon',
    'currencyId': 'SVC'
  },
  {
    'name': 'Eritrean nakfa',
    'currencyId': 'ERN'
  },
  {
    'name': 'Estonian kroon',
    'currencyId': 'EEK'
  },
  {
    'name': 'Ethiopian birr',
    'currencyId': 'ETB'
  },
  {
    'name': 'EU euro',
    'currencyId': 'EUR'
  },
  {
    'name': 'Falkland Islands pound',
    'currencyId': 'FKP'
  },
  {
    'name': 'Fiji dollar',
    'currencyId': 'FJD'
  },
  {
    'name': 'Gambian dalasi',
    'currencyId': 'GMD'
  },
  {
    'name': 'Georgian lari',
    'currencyId': 'GEL'
  },
  {
    'name': 'Ghanaian new cedi',
    'currencyId': 'GHS'
  },
  {
    'name': 'Gibraltar pound',
    'currencyId': 'GIP'
  },
  {
    'name': 'Gold (ounce)',
    'currencyId': 'XAU'
  },
  {
    'name': 'Gold franc',
    'currencyId': 'XFO'
  },
  {
    'name': 'Guatemalan quetzal',
    'currencyId': 'GTQ'
  },
  {
    'name': 'Guernsey pound',
    'currencyId': 'GGP'
  },
  {
    'name': 'Guinean franc',
    'currencyId': 'GNF'
  },
  {
    'name': 'Guyana dollar',
    'currencyId': 'GYD'
  },
  {
    'name': 'Haitian gourde',
    'currencyId': 'HTG'
  },
  {
    'name': 'Honduran lempira',
    'currencyId': 'HNL'
  },
  {
    'name': 'Hong Kong SAR dollar',
    'currencyId': 'HKD'
  },
  {
    'name': 'Hungarian forint',
    'currencyId': 'HUF'
  },
  {
    'name': 'Icelandic krona',
    'currencyId': 'ISK'
  },
  {
    'name': 'IMF special drawing right',
    'currencyId': 'XDR'
  },
  {
    'name': 'Indian rupee',
    'currencyId': 'INR'
  },
  {
    'name': 'Indonesian rupiah',
    'currencyId': 'IDR'
  },
  {
    'name': 'Iranian rial',
    'currencyId': 'IRR'
  },
  {
    'name': 'Iraqi dinar',
    'currencyId': 'IQD'
  },
  {
    'name': 'Isle of Man pound',
    'currencyId': 'IMP'
  },
  {
    'name': 'Israeli new shekel',
    'currencyId': 'ILS'
  },
  {
    'name': 'Jamaican dollar',
    'currencyId': 'JMD'
  },
  {
    'name': 'Japanese yen',
    'currencyId': 'JPY'
  },
  {
    'name': 'Jersey pound',
    'currencyId': 'JEP'
  },
  {
    'name': 'Jordanian dinar',
    'currencyId': 'JOD'
  },
  {
    'name': 'Kazakh tenge',
    'currencyId': 'KZT'
  },
  {
    'name': 'Kenyan shilling',
    'currencyId': 'KES'
  },
  {
    'name': 'Kuwaiti dinar',
    'currencyId': 'KWD'
  },
  {
    'name': 'Kyrgyz som',
    'currencyId': 'KGS'
  },
  {
    'name': 'Lao kip',
    'currencyId': 'LAK'
  },
  {
    'name': 'Latvian lats',
    'currencyId': 'LVL'
  },
  {
    'name': 'Lebanese pound',
    'currencyId': 'LBP'
  },
  {
    'name': 'Lesotho loti',
    'currencyId': 'LSL'
  },
  {
    'name': 'Liberian dollar',
    'currencyId': 'LRD'
  },
  {
    'name': 'Libyan dinar',
    'currencyId': 'LYD'
  },
  {
    'name': 'Lithuanian litas',
    'currencyId': 'LTL'
  },
  {
    'name': 'Macao SAR pataca',
    'currencyId': 'MOP'
  },
  {
    'name': 'Macedonian denar',
    'currencyId': 'MKD'
  },
  {
    'name': 'Malagasy ariary',
    'currencyId': 'MGA'
  },
  {
    'name': 'Malawi kwacha',
    'currencyId': 'MWK'
  },
  {
    'name': 'Malaysian ringgit',
    'currencyId': 'MYR'
  },
  {
    'name': 'Maldivian rufiyaa',
    'currencyId': 'MVR'
  },
  {
    'name': 'Mauritanian ouguiya',
    'currencyId': 'MRO'
  },
  {
    'name': 'Mauritius rupee',
    'currencyId': 'MUR'
  },
  {
    'name': 'Mexican peso',
    'currencyId': 'MXN'
  },
  {
    'name': 'Moldovan leu',
    'currencyId': 'MDL'
  },
  {
    'name': 'Mongolian tugrik',
    'currencyId': 'MNT'
  },
  {
    'name': 'Moroccan dirham',
    'currencyId': 'MAD'
  },
  {
    'name': 'Mozambique new metical',
    'currencyId': 'MZN'
  },
  {
    'name': 'Myanmar kyat',
    'currencyId': 'MMK'
  },
  {
    'name': 'Namibian dollar',
    'currencyId': 'NAD'
  },
  {
    'name': 'Nepalese rupee',
    'currencyId': 'NPR'
  },
  {
    'name': 'Netherlands Antillian guilder',
    'currencyId': 'ANG'
  },
  {
    'name': 'New Zealand dollar',
    'currencyId': 'NZD'
  },
  {
    'name': 'Nicaraguan cordoba oro',
    'currencyId': 'NIO'
  },
  {
    'name': 'Nigerian naira',
    'currencyId': 'NGN'
  },
  {
    'name': 'North Korean won',
    'currencyId': 'KPW'
  },
  {
    'name': 'Norwegian krone',
    'currencyId': 'NOK'
  },
  {
    'name': 'Omani rial',
    'currencyId': 'OMR'
  },
  {
    'name': 'Pakistani rupee',
    'currencyId': 'PKR'
  },
  {
    'name': 'Palladium (ounce)',
    'currencyId': 'XPD'
  },
  {
    'name': 'Panamanian balboa',
    'currencyId': 'PAB'
  },
  {
    'name': 'Papua New Guinea kina',
    'currencyId': 'PGK'
  },
  {
    'name': 'Paraguayan guarani',
    'currencyId': 'PYG'
  },
  {
    'name': 'Peruvian nuevo sol',
    'currencyId': 'PEN'
  },
  {
    'name': 'Philippine peso',
    'currencyId': 'PHP'
  },
  {
    'name': 'Platinum (ounce)',
    'currencyId': 'XPT'
  },
  {
    'name': 'Polish zloty',
    'currencyId': 'PLN'
  },
  {
    'name': 'Qatari rial',
    'currencyId': 'QAR'
  },
  {
    'name': 'Romanian new leu',
    'currencyId': 'RON'
  },
  {
    'name': 'Russian ruble',
    'currencyId': 'RUB'
  },
  {
    'name': 'Rwandan franc',
    'currencyId': 'RWF'
  },
  {
    'name': 'Saint Helena pound',
    'currencyId': 'SHP'
  },
  {
    'name': 'Samoan tala',
    'currencyId': 'WST'
  },
  {
    'name': 'Sao Tome and Principe dobra',
    'currencyId': 'STD'
  },
  {
    'name': 'Saudi riyal',
    'currencyId': 'SAR'
  },
  {
    'name': 'Seborgan luigino',
    'currencyId': 'SPL'
  },
  {
    'name': 'Serbian dinar',
    'currencyId': 'RSD'
  },
  {
    'name': 'Seychelles rupee',
    'currencyId': 'SCR'
  },
  {
    'name': 'Sierra Leone leone',
    'currencyId': 'SLL'
  },
  {
    'name': 'Silver (ounce)',
    'currencyId': 'XAG'
  },
  {
    'name': 'Singapore dollar',
    'currencyId': 'SGD'
  },
  {
    'name': 'Solomon Islands dollar',
    'currencyId': 'SBD'
  },
  {
    'name': 'Somali shilling',
    'currencyId': 'SOS'
  },
  {
    'name': 'South African rand',
    'currencyId': 'ZAR'
  },
  {
    'name': 'South Korean won',
    'currencyId': 'KRW'
  },
  {
    'name': 'Sri Lanka rupee',
    'currencyId': 'LKR'
  },
  {
    'name': 'Sudanese pound',
    'currencyId': 'SDG'
  },
  {
    'name': 'Suriname dollar',
    'currencyId': 'SRD'
  },
  {
    'name': 'Swaziland lilangeni',
    'currencyId': 'SZL'
  },
  {
    'name': 'Swedish krona',
    'currencyId': 'SEK'
  },
  {
    'name': 'Swiss franc',
    'currencyId': 'CHF'
  },
  {
    'name': 'Syrian pound',
    'currencyId': 'SYP'
  },
  {
    'name': 'Taiwan New dollar',
    'currencyId': 'TWD'
  },
  {
    'name': 'Tajik somoni',
    'currencyId': 'TJS'
  },
  {
    'name': 'Tanzanian shilling',
    'currencyId': 'TZS'
  },
  {
    'name': 'Thai baht',
    'currencyId': 'THB'
  },
  {
    'name': 'Tongan pa\'anga',
    'currencyId': 'TOP'
  },
  {
    'name': 'Trinidad and Tobago dollar',
    'currencyId': 'TTD'
  },
  {
    'name': 'Tunisian dinar',
    'currencyId': 'TND'
  },
  {
    'name': 'Turkish lira',
    'currencyId': 'TRY'
  },
  {
    'name': 'Turkmen new manat',
    'currencyId': 'TMT'
  },
  {
    'name': 'Tuvaluan dollar',
    'currencyId': 'TVD'
  },
  {
    'name': 'UAE dirham',
    'currencyId': 'AED'
  },
  {
    'name': 'Uganda new shilling',
    'currencyId': 'UGX'
  },
  {
    'name': 'UIC franc',
    'currencyId': 'XFU'
  },
  {
    'name': 'Ukrainian hryvnia',
    'currencyId': 'UAH'
  },
  {
    'name': 'Uruguayan peso uruguayo',
    'currencyId': 'UYU'
  },
  {
    'name': 'US dollar',
    'currencyId': 'USD'
  },
  {
    'name': 'Uzbekistani sum',
    'currencyId': 'UZS'
  },
  {
    'name': 'Vanuatu vatu',
    'currencyId': 'VUV'
  },
  {
    'name': 'Venezuelan bolivar fuerte',
    'currencyId': 'VEF'
  },
  {
    'name': 'Vietnamese dong',
    'currencyId': 'VND'
  },
  {
    'name': 'Yemeni rial',
    'currencyId': 'YER'
  },
  {
    'name': 'Zambian kwacha (obsolete)',
    'currencyId': 'ZMK'
  },
  {
    'name': 'Zambian kwacha',
    'currencyId': 'ZMW'
  },
  {
    'name': 'Zimbabwe dollar (initial)',
    'currencyId': 'ZWD'
  },
  {
    'name': 'Zimbabwe dollar (1st denomination)',
    'currencyId': 'ZWN'
  },
  {
    'name': 'Zimbabwe dollar (2nd denomination)',
    'currencyId': 'ZWR'
  },
  {
    'name': 'Zimbabwe dollar (3rd denomination)',
    'currencyId': 'ZWL'
  }
]

const currencyList = currencies.map(currentValue => {
  return currentValue.currencyId
}).sort()

const seed = async function (knex) {
  try {
    return await knex('currency').insert(currencies)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for currency has failed with the following error: ${err}`)
      return -1000
    }
  }
}

module.exports = {
  currencyList,
  seed
}
