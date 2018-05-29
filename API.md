# Central Ledger API
***

The central ledger has two APIs targeted at different consumers. The DFSP API is used by DFSPs to prepare and execute transfers, and for DFSPs to retrieve their current settlement position. The Admin API is used by the operational hub to manage DFSPs and ensure the health of the system.

#### [DFSP API](#dfsp-api) endpoints
* `POST` [**Create account**](#create-account)
* `GET` [**Get account**](#get-account)
* `PUT` [**Update account**](#update-account)
* `PUT` [**Update account settlement**](#update-account-settlement)
* `POST` [**Send message to account**](#send-message-to-account)
* `GET` [**Get position for account**](#get-position-for-account)
* `PUT` [**Prepare transfer**](#prepare-transfer) 
* `PUT` [**Fulfil transfer**](#fulfil-transfer)
* `PUT` [**Reject transfer**](#reject-transfer) 
* `GET` [**Get transfer by id**](#get-transfer-by-id)
* `GET` [**Get transfer fulfilment**](#get-transfer-fulfilment)
* `GET` [**Get net positions**](#get-net-positions) 
* `GET` [**Get metadata**](#get-metadata) 
* `POST` [**Get charge quote**](#get-a-charge-quote) 
* `POST` [**Get authentication token**](#get-authentication-token)
* `GET`  [**Health**](#health)

#### [Admin API](#admin-api) endpoints
* `POST` [**Create account**](#create-account-admin)
* `PUT`  [**Update admin account**](#update-admin-account)
* `GET`  [**Get all accounts**](#get-all-accounts)
* `POST` [**Create charge**](#create-charge)
* `PUT`  [**Update charge**](#update-charge)
* `GET`  [**Get all charges**](#get-all-charges)
* `GET`  [**Get available permissions**](#get-available-permissions)
* `POST` [**Create role**](#create-role)
* `PUT`  [**Update role**](#update-role)
* `DELETE`  [**Delete role**](#delete-role)
* `GET`  [**Get all roles**](#get-all-roles)
* `POST` [**Get authentication token**](#get-admin-authentication-token)
* `POST` [**Create user**](#create-user)
* `PUT` [**Update user**](#update-user)
* `DELETE` [**Delete user**](#delete-user)
* `GET`  [**Get user by id**](#get-user-by-id)
* `GET`  [**Get all users**](#get-all-users)
* `GET`  [**Get roles assigned to user**](#get-roles-assigned-to-user)
* `POST` [**Assign role to user**](#assign-role-to-user)
* `POST` [**Reject expired transfers**](#reject-expired-transfers)
* `POST` [**Reject expired tokens**](#reject-expired-tokens)
* `POST` [**Settle transfers and fees**](#settle-transfers-and-fees)
* `GET`  [**Health**](#admin-health)

The API endpoints often deal with these [data structures](#data-structures): 

* [**Transfer Object**](#transfer-object)
* [**Account Object**](#account-object)
* [**Notification Object**](#notification-object)
* [**Metadata Object**](#metadata-object)
* [**Position Object**](#position-object)
* [**Charge Object**](#charge-object)

Information about various errors returned can be found here:
* [**Error Information**](#error-information)

***

## DFSP API

#### Create account
The create account endpoint will create an account in the ledger.

##### HTTP Request
`POST http://central-ledger/accounts`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Account | An [Account object](#account-object) to create |

##### Response 201 Created
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Account | The newly-created [Account object](#account-object) as saved |

##### Request
``` http
POST http://central-ledger/accounts HTTP/1.1
Content-Type: application/json
{
  "name": "dfsp1",
  "password": "dfsp1_password"
}
```

##### Response
``` http
HTTP/1.1 201 CREATED
Content-Type: application/json
{
  "id": "http://central-ledger/accounts/dfsp1",
  "name": "dfsp1",
  "created": "2017-01-03T19:50:39.744Z",
  "balance": "0",
  "is_disabled": false,
  "ledger": "http://central-ledger"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| RecordExistsError | The account already exists (determined by name) |

``` http
{
  "id": "RecordExistsError",
  "message": "The account has already been registered"
}
```

#### Get account
The get account endpoint will return information about the account. To successfully retrieve an account, make sure the [account has been previously created.](#create-account)

##### HTTP Request
`GET http://central-ledger/accounts/dfsp1`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The unique name for the account |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Account | The [Account object](#account-object) as saved |

##### Request
``` http
  GET http://central-ledger/accounts/dfsp1 HTTP/1.1
```

##### Response
``` http
  HTTP/1.1 200 OK
  Content-Type: application/json
  {
    "id": "http://central-ledger/accounts/dfsp1",
    "name": "dfsp1",
    "ledger": "http://central-ledger"
  }
```

##### Response (Authenticated)
``` http
  HTTP/1.1 200 OK
  Content-Type: application/json
  {
    "id": "http://central-ledger/accounts/dfsp1",
    "name": "dfsp1",
    "created": "2016-09-28T17:03:37.168Z",
    "balance": 1000000,
    "is_disabled": false,
    "ledger": "http://central-ledger"
  }
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Update account
The update account endpoint will update the account's credentials and return the newly updated Account object.

##### HTTP Request
`PUT http://central-ledger/accounts/dfsp1`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The unique name for the account |

##### Request body
| Field | Type | Description |
| ----- | ---- | ----------- |
| password | String | The new password for the account |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Account | The [Account object](#account-object) as saved |

##### Request
``` http
  PUT http://central-ledger/accounts/dfsp1 HTTP/1.1
    Content-Type: application/json
  {
    "password": "12345"
  }
```

##### Response
``` http
  HTTP/1.1 200 OK
  Content-Type: application/json
  {
    "name": "dfsp1",
    "id": "http://localhost:3000/accounts/dfsp1",
    "created": "2017-02-23T17:11:35.928Z",
    "is_disabled": true,
    "_links": {
      "self": "http://localhost:3000/accounts/dfsp1"
    }
  }
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Update account settlement
The update account settlement endpoint will create a new account settlement with the account's id and return the newly updated account settlement.

##### HTTP Request
`PUT http://central-ledger/accounts/dfsp1/settlement`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The name for the account |

##### Request body
| Field | Type | Description |
| ----- | ---- | ----------- |
| account_number | String | The account number associated with the account's settlement |
| routing_number | String | The routing number associated with the account's settlement |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| account_id | URI | The id for the account |
| account_number | String | The account number associated with the account's settlement |
| routing_number | String | The routing number associated with the account's settlement |

##### Request
``` http
  PUT http://central-ledger/accounts/dfsp1/settlement HTTP/1.1
  Content-Type: application/json
  {
    "account_number": "12345",
    "routing_number": "1234567891011",
  }
```

##### Response
``` http
  HTTP/1.1 200 OK
  Content-Type: application/json
  {
    "account_id": "http://localhost:3000/accounts/dfsp1",
    "account_number": "12345",
    "routing_number": "1234567891011",
  }
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Send message to account
The send messages endpoint posts messages to different accounts

##### HTTP Request
`POST http://central-ledger/messages`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| ledger | URI | A link to the account's ledger |
| from | URI | A link to the from account |
| to | URI | A link to the to account |
| data | String | The data to be sent |

##### Response 201 Created
| Field | Type | Description |
| ----- | ---- | ----------- |

##### Request
``` http
POST http://central-ledger/messages HTTP/1.1
Content-Type: application/json
{
  "ledger": "http://central-ledger",
  "from": "http://central-ledger/accounts/from",
  "to": "http://central-ledger/accounts/to",
  "data": { "foo": "bar" }
}
```

##### Response
``` http
HTTP/1.1 201 CREATED
Content-Type: application/json
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| RecordExistsError | The account already exists (determined by name) |

``` http
{
  "id": "RecordExistsError",
  "message": "The account has already been registered"
}
```

#### Get position for account
The get account net positions endpoint returns the current net positions for the given account.

##### HTTP Request
`GET http://central-ledger/positions/dfsp1`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The unique name for the account |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| account | String | Resource identifier |
| fees | Position | The [Position object](#positions-object) for an account's fees |
| transfers | Position | The [Position object](#position-object) for an account's transfers |
| net | String | Net non-settled amount for the account as string|

##### Request
``` http
GET http://central-ledger/positions/dsfp1 HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
Content-Type: application/json
{
  "account": "http://localhost:3000/accounts/dfsp1",
  "fees": {
    "payments": "10",
    "receipts": "20",
    "net": "10"
  },
  "transfers": {
    "payments": "10",
    "receipts": "20",
    "net": "10"
  },
  "net": "20"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| UnprocessableEntityError | The provided entity is syntactically correct, but there is a generic semantic problem with it | 
``` http
{
  "id": "UnprocessableEntityError",
  "message": "The provided entity is syntactically correct, but there is a generic semantic problem with it"
}
```

#### Prepare transfer
The prepare transfer endpoint will create or update a transfer object. A transfer between two DFSPs must be prepared before it can be fulfilled. Before you can successfully prepare a transfer, make sure you have [created the corresponding accounts](#create-account).

##### HTTP Request
`PUT http://central-ledger/transfers/2d4f2a70-e0d6-42dc-9efb-6d23060ccd6f`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| id | String | A new UUID to identify this transfer |

##### Request body
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Transfer | A [Transfer object](#transfer-object) to describe the transfer that should take place. For a conditional transfer, this includes an execution_condition |

##### Response 201 Created
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Transfer | The newly-created [Transfer object](#transfer-object) as saved |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Transfer | The updated [Transfer object](#transfer-object) as saved |

##### Request
``` http
PUT http://central-ledger/transfers/2d4f2a70-e0d6-42dc-9efb-6d23060ccd6f HTTP/1.1
Content-Type: application/json
{
    "id": "http://central-ledger/transfers/2d4f2a70-e0d6-42dc-9efb-6d23060ccd6f",
    "ledger": "http://central-ledger",
    "debits": [{
      "account": "http://central-ledger/accounts/dfsp1",
      "amount": "50"
    }],
    "credits": [{
      "account": "http://central-ledger/accounts/dfsp2",
      "amount": "50"
    }],
    "execution_condition": "ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0",
    "expires_at": "2016-12-26T00:00:01.000Z"
  }
```

##### Response
``` http
HTTP/1.1 201 CREATED
Content-Type: application/json
{
  "id": "http://central-ledger/transfers/2d4f2a70-e0d6-42dc-9efb-6d23060ccd6f",
  "ledger": "http://central-ledger",
  "debits": [
    {
      "account": "http://central-ledger/accounts/dfsp1",
      "amount": 50
    }
  ],
  "credits": [
    {
      "account": "http://central-ledger/accounts/dfsp2",
      "amount": 50
    }
  ],
  "execution_condition": "ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0",
  "expires_at": "2016-12-26T00:00:01.000Z",
  "state": "prepared",
  "timeline": {
    "prepared_at": "2017-01-03T16:16:18.958Z"
  }
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| UnprocessableEntityError | The provided entity is syntactically correct, but there is a generic semantic problem with it | 
``` http
{
  "id": "UnprocessableEntityError",
  "message": "The provided entity is syntactically correct, but there is a generic semantic problem with it"
}
```

#### Fulfil transfer 
The fulfil transfer endpoint will either execute or cancel a transfer, depending on the existence of an *execution_condition* or *cancellation_condition*. To successfully fulfil a transfer, make sure the [transfer has previously been prepared.](#prepare-transfer) 

##### HTTP Request
`PUT http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfilment`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `text/plain` |

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| id | String | Transfer UUID |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| Fulfilment | String | A fulfilment in string format |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Transfer | The [Transfer object](#transfer-object) as fulfilled |

##### Request
``` http
PUT http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfilment HTTP/1.1
Content-Type: text/plain
oAKAAA
```

##### Response
``` http
HTTP/1.1 201 OK
Content-Type: application/json
{
  "id": "http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204",
  "ledger": "http://central-ledger",
  "debits": [
    {
      "memo": {
        "path": "blah",
        "interledger": "blah"
      },
      "amount": 50,
      "account": "http://central-ledger/accounts/dfsp1"
    }
  ],
  "credits": [
    {
      "memo": {
        "path": "blah",
        "interledger": "blah"
      },
      "amount": 50,
      "account": "http://central-ledger/accounts/dfsp2"
    }
  ],
  "execution_condition": "ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0",
  "expires_at": "2016-12-26T00:00:01.000Z",
  "state": "executed",
  "timeline": {
    "prepared_at": "2016-12-19T16:04:01.316Z",
    "executed_at": "2016-12-19T16:04:55.766Z"
  }
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| UnprocessableEntityError | The provided entity is syntactically correct, but there is a generic semantic problem with it |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Reject transfer
The reject transfer endpoint rejects the transfer with the given message. To successfully reject a transfer, make sure the [transfer has previously been prepared.](#prepare-transfer)

##### HTTP Request
`PUT http://central-ledger/transfers/7d4f2a70-e0d6-42dc-9efb-6d23060ccd6f/rejection`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| id | String | Transfer UUID |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| Rejection | String | The rejection message in string format |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Transfer | The [Transfer object](#transfer-object) as rejected |

##### Request
``` http
PUT http://central-ledger/transfers/7d4f2a70-e0d6-42dc-9efb-6d23060ccd6f/rejection HTTP/1.1
Content-Type: text/plain
this transfer is bad
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "id": "http://central-ledger/transfers/7d4f2a70-e0d6-42dc-9efb-6d23060ccd6f",
  "ledger": "http://central-ledger",
  "debits": [
    {
      "memo": {
        "path": "blah",
        "interledger": "blah"
      },
      "amount": 50,
      "account": "http://central-ledger/accounts/dfsp1"
    }
  ],
  "credits": [
    {
      "memo": {
        "path": "blah",
        "interledger": "blah"
      },
      "amount": 50,
      "account": "http://central-ledger/accounts/dfsp2"
    }
  ],
  "execution_condition": "ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0",
  "expires_at": "2016-12-26T00:00:01.000Z",
  "state": "rejected",
  "timeline": {
    "prepared_at": "2017-01-03T16:16:18.958Z",
    "rejected_at": "2017-01-03T19:58:42.100Z"
  },
  "rejection_reason": "this transfer is bad"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "UnpreparedTransferError",
  "message": "The provided entity is syntactically correct, but there is a generic semantic problem with it."
}
```

#### Get transfer by id

##### HTTP Request
`GET http://central-ledger/transfers/2d4f2a70-e0d6-42dc-9efb-6d23060ccd6f`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| id | String | Transfer UUID |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Transfer | The [Transfer object](#transfer-object) as saved |

##### Request
``` http
GET http://central-ledger/transfers/2d4f2a70-e0d6-42dc-9efb-6d23060ccd6fHTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "id": "http://central-ledger/transfers/2d4f2a70-e0d6-42dc-9efb-6d23060ccd6f",
  "ledger": "http://central-ledger",
  "debits": [
    {
      "account": "http://central-ledger/accounts/dfsp1",
      "amount": "50.00",
      "memo": "{\"path\":\"blah\",\"interledger\":\"blah\"}"
    }
  ],
  "credits": [
    {
      "account": "http://central-ledger/accounts/dfsp2",
      "amount": "50.00",
      "memo": "{\"path\":\"blah\",\"interledger\":\"blah\"}"
    }
  ],
  "execution_condition": "ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0",
  "expires_at": "2016-12-26T00:00:01.000Z",
  "state": "executed",
  "timeline": {
    "prepared_at": "2016-12-19T16:04:01.316Z",
    "executed_at": "2016-12-19T16:04:55.766Z"
  },
  "rejection_reason": null
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get transfer fulfilment
The get transfer fulfilment endpoint will return the fulfilment for a transfer that has been executed or cancelled. To successfully retrieve a transfer fulfilment, make sure the [transfer has previously been fulfilled.](#fulfil-transfer)

##### HTTP Request
`GET http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfilment`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| id | String | Transfer UUID |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Fulfilment | String | The fulfilment for the transfer |

#### Request
``` http
GET http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfilment HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
oAKAAA
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get net positions
The get current net positions endpoint returns the current net positions for all accounts in the ledger.

##### HTTP Request
`GET http://central-ledger/positions`

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| positions | Array | List of current [Position objects](#position-object) for the ledger |

#### Request
``` http
GET http://central-ledger/positions HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "positions": [
    {
      "account": "http://central-ledger/accounts/dfsp1",
      "payments": "0",
      "receipts": "0",
      "net": "0"
    },
    {
      "account": "http://central-ledger/accounts/dfsp2",
      "payments": "100",
      "receipts": "0",
      "net": "-100"
    },
    {
      "account": "http://central-ledger/accounts/dfsp3",
      "payments": "0",
      "receipts": "100",
      "net": "100"
    }
  ]
}
```

#### Get net positions for account
The get current net positions endpoint returns the current net positions for all accounts in the ledger.

##### HTTP Request
`GET http://central-ledger/positions/dfsp1`

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | [Position objects](#position-object) for the account |

#### Request
``` http
GET http://central-ledger/positions/dfsp1 HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "account": "http://localhost:3000/accounts/dfsp1",
  "fees": {
    "payments": "4",
    "receipts": "0",
    "net": "-4"
  },
  "transfers": {
    "payments": "40",
    "receipts": "0",
    "net": "-40"
  },
  "net": "-44"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get metadata
The get metada endpoint returns metadata associated with the ledger.

##### HTTP Request
`GET http://central-ledger`

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Metadata | Object | The [Metadata object](#metadata-object) for the ledger |

##### Request
``` http
GET http://central-ledger HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "currency_code": null,
  "currency_symbol": null,
  "ledger": "http://central-ledger",
  "urls": {
    "auth_token": "http://central-ledger/auth_token",
    "health": "http://central-ledger/health",
    "positions": "http://central-ledger/positions",
    "account": "http://central-ledger/accounts/:name",
    "accounts": "http://central-ledger/accounts",
    "send_message": "http://central-ledger/messages",
    "transfer": "http://central-ledger/transfers/:id",
    "transfer_fulfillment": "http://central-ledger/transfers/:id/fulfilment",
    "transfer_rejection": "http://central-ledger/transfers/:id/rejection",
    "notifications": "ws://central-ledger/websocket"
  },
  "precision": 10,
  "scale": 2
}
```

#### Get a charge quote
Get a list of charge quotes for a given amount, that the sender would be responsible for paying

##### HTTP Request
`POST http://central-ledger/charges/quote`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| amount | Decimal | The amount for quote |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| N/A | Array | A list of charge quotes |

##### Request
``` http
POST http://central-ledger/charges/quotes HTTP/1.1
Content-Type: application/json
{
  "amount": "10.00"
}
```

##### Response
``` http
HTTP/1.1 200 OK
Content-Type: application/json
[
  {
    "name": "charge1",
    "charge_type": "fee",
    "code": "001",
    "amount": "0.25",
    "currency_code": "USD",
    "currency_symbol": "$"
  },
  {
    "name": "charge2",
    "charge_type": "fee",
    "code": "002",
    "amount": "2.00",
    "currency_code": "USD",
    "currency_symbol": "$"
  }
]
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| InvalidBodyError | Body does not match schema |

``` http
{
  "id": "InvalidBodyError",
  "message": "Body does not match schema"
}
```

#### Get authentication token
The get authentication endpoint generates an authentication token

##### HTTP Request
`GET http://central-ledger/auth_token`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Basic  | Defaults to admin:admin | 

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| token | String | The generated authentication token |

##### Request
``` http
GET http://central-ledger/auth_token HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "token": "1234token4321"
}
```

#### Health
Get the current status of the service

##### HTTP Request
`GET http://central-ledger/health`

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| status | String | The status of the ledger, *OK* if the service is working |

##### Request
``` http
GET http://central-ledger/health HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "status": "OK"
}
```

## Admin API

#### Create account admin
The create account endpoint will create an account in the ledger.

##### HTTP Request
`POST http://central-ledger/accounts`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Account | An [Account object](#account-object) to create |

##### Response 201 Created
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Account | The newly-created [Account object](#account-object) as saved |

##### Request
``` http
POST http://central-ledger/accounts HTTP/1.1
Content-Type: application/json
{
  "name": "dfsp1",
  "password": "dfsp1_password"
}
```

##### Response
``` http
HTTP/1.1 201 CREATED
Content-Type: application/json
{
  "id": "http://central-ledger/accounts/dfsp1",
  "name": "dfsp1",
  "created": "2017-01-03T19:50:39.744Z",
  "balance": "0",
  "is_disabled": false,
  "ledger": "http://central-ledger"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| RecordExistsError | The account already exists (determined by name) |

``` http
{
  "id": "RecordExistsError",
  "message": "The account has already been registered"
}
```
#### Get account admin
The get account endpoint will return information about the account. To successfully retrieve an account, make sure the [account has been previously created.](#create-account)

##### HTTP Request
`GET http://central-ledger-admin/accounts/dfsp1`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The unique name for the account |

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Account | The [Account object](#account-object) as saved |

##### Request
``` http
  GET http://central-ledger/accounts/dfsp1 HTTP/1.1
```

##### Response
``` http
  HTTP/1.1 200 OK
  Content-Type: application/json
  {
    "id": "http://central-ledger/accounts/dfsp1",
    "name": "dfsp1",
    "created": "2016-09-28T17:03:37.168Z",
    "balance": 1000000,
    "is_disabled": false,
    "ledger": "http://central-ledger"
  }
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Update admin account
The update admin account endpoint will update the account's 'is_disabled' field and return the newly updated Account object.

##### HTTP Request
`PUT http://central-ledger-admin/accounts/dfsp1`

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The unique name for the account |

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Account | The [Account object](#account-object) as saved |

##### Request
``` http
  PUT http://central-ledger-admin/accounts/dfsp1 HTTP/1.1
```

##### Response
``` http
  HTTP/1.1 200 OK
  Content-Type: application/json
  {
    "name": "dfsp1",
    "id": "http://localhost:3000/accounts/dfsp1",
    "created": "2017-02-23T17:11:35.928Z",
    "is_disabled": true,
    "_links": {
      "self": "http://localhost:3000/accounts/dfsp1"
    }
  }
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get all accounts
The get all accounts endpoint lists all created accounts

##### HTTP Request
`GET http://central-ledger-admin/accounts`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | An array of all created [Account objects](#account-object) |

#### Request
``` http
GET http://central-ledger-admin/accounts HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
[
  {
    "id": "http://central-ledger/accounts/dfsp1",
    "name": "dfsp1",
    "created": "2016-09-28T17:03:37.168Z",
    "balance": 1000000,
    "is_disabled": false,
    "ledger": "http://central-ledger"
  },
  {
    "id": "http://central-ledger/accounts/dfsp2",
    "name": "dfsp2",
    "created": "2016-09-28T17:03:37.168Z",
    "balance": 1000000,
    "is_disabled": false,
    "ledger": "http://central-ledger"
  }
]
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Create charge
Create a charge that will be applied across the dfsp on transfer execution

##### HTTP Request
`POST http://central-ledger-admin/charges`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | Unique name for the charge |
| charge_type | String | Type of the charge, should be *fee* |
| rate_type | String | How the charge rate is applied, either *flat* or *percent* |
| rate | String | Charge rate, represented as a decimal for percent *(5% is 0.05)* and as the actual value for flat|
| minimum | String | Minimum transfer amount needed to apply the charge|
| maximum | String | Maximum transfer amount needed to apply the charge|
| code | String | Three character code used to identify the charge|
| is_active | Boolean | Set by admin, determines whether charge should be applied or not|
| payer | String | Account that pays the fee generated by the charge, either *sender*, *receiver*, or *ledger*|
| payee | String | Account that receives the fee generated by the charge, either *sender*, *receiver*, or *ledger*|

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Charge | Newly created charge |

##### Request
``` http
POST http://central-ledger-admin/charges HTTP/1.1
Content-Type: application/json
{
	"name": "charge",
	"charge_type": "fee",
	"rate_type": "flat",
	"rate": "1.00",
	"minimum": "0.00", 
	"maximum": "100.00",
	"code": "001",
	"is_active": true,
	"payer": "sender",
	"payee": "receiver"
}
```

##### Response
``` http
HTTP/1.1 201 CREATED
Content-Type: application/json
{
  "name": "charge",
  "id": 5,
  "charge_type": "fee",
  "rate_type": "flat",
  "rate": "1.00",
  "minimum": "0.00",
  "maximum": "100.00",
  "code": "001",
  "is_active": true,
  "created": "2017-03-10T17:56:35.966Z",
  "payer": "sender",
  "payee": "receiver"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| InvalidBodyError | Body does not match schema. |
| ValidationError | Payer and payee should be set to 'sender', 'receiver', or 'ledger' and should not have the same value. |
| RecordExistsError | The charge has already been created. |

``` http
{
  "id": "InvalidBodyError",
  "message": "Body does not match schema"
}
```

#### Update charge
Update an existing charge, only the name, charge type, minimum, maximum, code, and is active fields may be updated.

##### HTTP Request
`PUT http://central-ledger-admin/charges/charge_name`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### URL Params
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The unique name for the account |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | Unique name for the charge |
| charge_type | String | Type of the charge, should be *fee* |
| minimum | String | Minimum transfer amount needed to apply the charge|
| maximum | String | Maximum transfer amount needed to apply the charge|
| code | String | Three character code used to identify the charge|
| is_active | Boolean | Set by admin, determines whether charge should be applied or not|

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Charge | Newly updated charge |

##### Request
``` http
PUT http://central-ledger-admin/charges/charge_name HTTP/1.1
Content-Type: application/json
{
	"name": "updated_charge_name",
	"charge_type": "fee",
	"minimum": "0.01", 
	"maximum": "100.01",
	"code": "002",
	"is_active": false
}
```

##### Response
``` http
HTTP/1.1 200 OK
Content-Type: application/json
{
  "name": "updated_charge_name",
  "id": 5,
  "charge_type": "fee",
  "rate_type": "flat",
  "rate": "1.00",
  "minimum": "0.01",
  "maximum": "100.01",
  "code": "002",
  "is_active": false,
  "created": "2017-03-10T17:56:35.966Z",
  "payer": "sender",
  "payee": "receiver"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| InvalidBodyError | Body does not match schema. |
| ValidationError | Payer and payee should be set to 'sender', 'receiver', or 'ledger' and should not have the same value. |
| RecordExistsError | The charge has already been created. |

``` http
{
  "id": "InvalidBodyError",
  "message": "Body does not match schema"
}
```

#### Get all charges
The get all charges endpoint lists all created charges

##### HTTP Request
`GET http://central-ledger-admin/charges`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | An array of all created [Charge objects](#charge-object) |

#### Request
``` http
GET http://central-ledger-admin/charges HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
[
  {
    "name": "fee_1",
    "id": 1,
    "charge_type": "fee",
    "rate_type": "flat",
    "rate": "1.00",
    "minimum": "0.00",
    "maximum": "15.00",
    "code": "001",
    "is_active": true,
    "created": "2017-04-10T19:49:54.850Z",
    "payer": "sender",
    "payee": "receiver"
  }
]
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get available permissions
The get available permissions endpoint lists all available permissions

##### HTTP Request
`GET http://central-ledger-admin/permissions`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | An array of [Permission objects](#permission-object) |

#### Request
``` http
GET http://central-ledger-admin/permissions HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
[
  {
    "key": "ACCOUNTS_CREATE",
    "description": "Create an account"
  },
  {
    "key": "ACCOUNTS_LIST",
    "description": "List all accounts"
  }
]
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Create role
The create role endpoint will create a user role.

##### HTTP Request
`POST http://central-ledger-admin/roles`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The name of the role |
| description | String | The description of the role |
| permissions | Array | An array of [Permission object](#permission-object) keys |

##### Response 201 Created
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Role | The newly-created [Role object](#role-object) as saved |

##### Request
``` http
POST http://central-ledge-adminr/roles HTTP/1.1
Content-Type: application/json
{
	"name" : "Create role.",
	"description" : "An admin role for creating and listing users.",
	"permissions" : ["ACCOUNTS_CREATE, ACCOUNTS_LIST"]
}
```

##### Response
``` http
HTTP/1.1 201 CREATED
Content-Type: application/json
{
  "roleId": "374885fd-2384-429c-9355-57466aff2dd2",
  "name": "Create role.",
  "description": "An admin role for creating and listing users.",
  "permissions": [
    "ACCOUNTS_CREATE, ACCOUNTS_LIST"
  ]
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| RecordExistsError | The role already exists (determined by name) |

``` http
{
  "id": "RecordExistsError",
  "message": "The role has already been created"
}
```

#### Update role
The update role endpoint will update a given user role.

##### HTTP Request
`PUT http://central-ledger-admin/roles/374885fd-2384-429c-9355-57466aff2dd2`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| name | String | The name of the role |
| description | String | The description of the role |
| permissions | Array | An array of [Permission object](#permission-object) keys |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Role | The newly-created [Role object](#role-object) as saved |

##### Request
``` http
PUT http://central-ledge-adminr/roles/374885fd-2384-429c-9355-57466aff2dd2 HTTP/1.1
Content-Type: application/json
{
	"name" : "Create role.",
	"description" : "An admin role for creating, listing, and deleting users.",
	"permissions" : ["ACCOUNTS_CREATE, ACCOUNTS_LIST, ACCOUNT_DELETE"]
}
```

##### Response
``` http
HTTP/1.1 20O OK
Content-Type: application/json
{
  "roleId": "374885fd-2384-429c-9355-57466aff2dd2",
  "name": "Create role.",
  "description": "An admin role for creating and listing, and deleting users.",
  "permissions": [
    "ACCOUNTS_CREATE, ACCOUNTS_LIST, ACCOUNT_DELETE"
  ]
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Delete role
The delete role endpoint will delete a given user role.

##### HTTP Request
`DELETE http://central-ledger-admin/roles/374885fd-2384-429c-9355-57466aff2dd2`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Response 204 No Content
| Field | Type | Description |
| ----- | ---- | ----------- |

##### Request
``` http
DELETE http://central-ledge-adminr/roles/374885fd-2384-429c-9355-57466aff2dd2 HTTP/1.1
Content-Type: application/json
```

##### Response
``` http
HTTP/1.1 204 NO CONTENT
Content-Type: application/json
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```
#### Get all roles
The get all roles endpoint returns a list of all roles for the central ledger

##### HTTP Request
`GET http://central-ledger-admin/roles`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | List of [Role objects](#role-object) for the central ledger |

#### Request
``` http
GET http://central-ledger-admin/roles HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
[
  {
    "roleId": "7d3bdc7a-2f83-456f-b174-3ad1f477c7be",
    "name": "Account Manager",
    "description": "Create a view accounts.",
    "permissions": [
      "ACCOUNTS_CREATE",
      "ACCOUNTS_LIST"
    ]
  },
  {
    "roleId": "7d3bdc7a-2f54-456f-b174-3ad1f477c7b2",
    "name": "User Manager",
    "description": "Create a view users",
    "permissions": [
      "USERS_CREATE",
      "USERS_LIST"
    ]
  }
]
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get admin authentication token
The get admin authentication token endpoint generates an admin authentication token

##### HTTP Request
`POST http://central-ledger-admin/auth_token`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| token | String | The generated authentication token |

#### Request
``` http
POST http://central-ledger-admin/auth_token HTTP/1.1
Content-Type: application/json
{
  "key": "login_key"
}
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "token": "1234token4321"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Create user
The create user endpoint will create an admin user.

##### HTTP Request
`POST http://central-ledger-admin/users`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | User | A [User object](#user-object) to create |

##### Response 201 Created
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | User | The newly-created [User object](#user-object) as saved |

##### Request
``` http
POST http://central-ledger-admin/users HTTP/1.1
Content-Type: application/json
{
  "firstName": "First",
  "lastName": "Last",
  "email": "email@central-ledger.com",
  "key": "login_key"
}
```

##### Response
``` http
HTTP/1.1 201 CREATED
Content-Type: application/json
{
  "userId": "e181fc02",
  "key": "key",
  "lastName": "Last",
  "firstName": "First",
  "email": "email@central-ledger.com",
  "isActive": true,
  "createdDate": "2017-04-10T21:15:06.378Z"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| RecordExistsError | The account already exists (determined by name) |

``` http
{
  "id": "RecordExistsError",
  "message": "The account has already been registered"
}
```

#### Update user
The update user endpoint will update the give user.

##### HTTP Request
`PUT http://central-ledger-admin/users/e181fc02`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | User | A [User object](#user-object) to update |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | User | The update [User object](#user-object) as saved |

##### Request
``` http
PUT http://central-ledger-admin/users HTTP/1.1
Content-Type: application/json
{
  "firstName": "FirstA",
  "lastName": "LastB",
  "email": "email@central-ledger.com",
  "key": "login_key"
}
```

##### Response
``` http
HTTP/1.1 200 OK
Content-Type: application/json
{
  "userId": "e181fc02",
  "key": "key",
  "lastName": "LastB",
  "firstName": "FirstA",
  "email": "email@central-ledger.com",
  "isActive": true,
  "createdDate": "2017-04-10T21:15:06.378Z"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Delete user
The get user by id endpoint returns an admin user with the given id

##### HTTP Request
`DELETE http://central-ledger-admin/users/e181fc02`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |

#### Request
``` http
DELETE http://central-ledger-admin/users/e181fc02 HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get user by id
The get user by id endpoint returns an admin user with the given id

##### HTTP Request
`GET http://central-ledger-admin/users/e181fc02`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | User | [User object](#user-object) for the given id|

#### Request
``` http
GET http://central-ledger-admin/users/e181fc02 HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "userId": "e181fc02",
  "key": "key",
  "lastName": "lastName",
  "firstName": "firstName",
  "email": "email@central-ledger.com",
  "isActive": true,
  "createdDate": "2017-04-10T21:15:06.378Z"
}
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get all users
The get all users endpoint returns all admin users for the central ledger

##### HTTP Request
`GET http://central-ledger-admin/users`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | A list of [User objects](#user-object) for the central ledger |

#### Request
``` http
GET http://central-ledger-admin/users HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
[
  {
  "userId": "e181fc02",
  "key": "key",
  "lastName": "lastName",
  "firstName": "firstName",
  "email": "email@central-ledger.com",
  "isActive": true,
  "createdDate": "2017-04-10T21:15:06.378Z"
},
{
  "userId": "e181fc03",
  "key": "key",
  "lastName": "lastName2",
  "firstName": "firstName2",
  "email": "email2@central-ledger.com",
  "isActive": false,
  "createdDate": "2017-04-10T21:15:06.378Z"
}
]
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Get roles assigned to user
This endpoint returns a list of a user's roles

##### HTTP Request
`GET http://central-ledger-admin/users/e181fc02/roles`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | An array of [Role objects](#role-object) for the account |

#### Request
``` http
GET http://central-ledger-admin/users/e181fc02/roles HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
[
  {
    "roleId": "7d3bdc7a-2f83-456f-b174-3ad1f477c7be",
    "name": "Create account",
    "description": "Role for creating and listing users",
    "permissions": [
      "ACCOUNTS_CREATE",
      "ACCOUNTS_LIST"
    ]
  }
]
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Assign role to user
This endpoint assigns a role to an admin user

##### HTTP Request
`POST http://central-ledger/users/e181fc02/roles`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Request Body
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | An array of role ids |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | An array of [Role objects](#role-object) for the account |

##### Request
``` http
POST http://central-ledger/accounts HTTP/1.1
Content-Type: application/json
["7d3bdc7a-2f83-456f-b174-3ad1f477c7be", "7d3bdc7a-2f83-456f-b174-3ad1f477c7cf"]
```

##### Response
``` http
HTTP/1.1 200 OK
Content-Type: application/json
[
  {
    "roleId": "7d3bdc7a-2f83-456f-b174-3ad1f477c7be",
    "name": "Create account",
    "description": "Role for creating and listing users",
    "permissions": [
      "ACCOUNTS_CREATE",
      "ACCOUNTS_LIST"
    ]
  }
]
```

##### Errors (4xx)
| Field | Description |
| ----- | ----------- |
| NotFoundError | The requested resource could not be found |
``` http
{
  "id": "NotFoundError",
  "message": "The requested resource could not be found."
}
```

#### Reject expired transfers
This endpoint rejects all expired transfers

##### HTTP Request
`POST http://central-ledger-admin/webhooks/reject-expired-transfers`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | A list of rejected transfer ids |

##### Request
``` http
POST http://central-ledger-admin/webhooks/reject-expired-transfers HTTP/1.1
Content-Type: application/json
```

##### Response
``` http
HTTP/1.1 200 OK
Content-Type: application/json
[12, 13, 14]
```

#### Reject expired tokens
This endpoint rejects all expired tokens

##### HTTP Request
`POST http://central-ledger-admin/webhooks/reject-expired-tokens`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| Object | Array | A list of rejected tokens |

##### Request
``` http
POST http://central-ledger-admin/webhooks/reject-expired-transfers HTTP/1.1
Content-Type: application/json
```

##### Response
``` http
HTTP/1.1 200 OK
Content-Type: application/json
["123-abc", "456-def", "789-ghi"]
```

#### Settle transfers and fees
The settle transfers and fees endpoint settles all unsettled transfers and fees

##### HTTP Request
`POST http://central-ledger-admin/webhooks/settle-transfers`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Content-Type | String | Must be set to `application/json` |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| transfers | Array | A list of settled transfer ids |
| fees | Array | A list of settled fee ids |

##### Request
``` http
POST http://central-ledger-admin/webhooks/reject-expired-transfers HTTP/1.1
Content-Type: application/json
```

##### Response
``` http
HTTP/1.1 200 OK
Content-Type: application/json
{
    "transfers": [
        {
            "source": {
                "account_number": "1234",
                "routing_number": "5678"
            },
            "destination": {
                "account_number": "4321",
                "routing_number": "8765"
            },
            "amount": {
                "currency_code": "$",
                "value": "20.00",
                "description": "dfsp2"
            }
        }
    ],
    "fees": [
        {
            "source": {
                "account_number": "1234",
                "routing_number": "5678"
            },
            "destination": {
                "account_number": "4321",
                "routing_number": "8765"
            },
            "amount": {
                "currency_code": "$",
                "value": "3",
                "description": "dfsp2"
            }
        }
    ]
}
```

#### Admin health
Get the current status of the admin service

##### HTTP Request
`GET http://central-ledger-admin/health`

##### Headers
| Field | Type | Description |
| ----- | ---- | ----------- |
| Authorization | Bearer Token  | JWT based access token |

##### Response 200 OK
| Field | Type | Description |
| ----- | ---- | ----------- |
| status | String | The status of the ledger, *OK* if the service is working |

##### Request
``` http
GET http://central-ledger-admin/health HTTP/1.1
```

##### Response
``` http
HTTP/1.1 200 OK
{
  "status": "OK"
}
```
***

## Data Structures

### Transfer Object

A transfer represents money being moved between two DFSP accounts at the central ledger.

The transfer must specify an execution_condition, in which case it executes automatically when presented with the fulfilment for the condition. (Assuming the transfer has not expired or been canceled first.) Currently, the central ledger only supports the condition type of [PREIMAGE-SHA-256](https://interledger.org/five-bells-condition/spec.html#rfc.section.4.1) and a max fulfilment length of 65535. 

Some fields are Read-only, meaning they are set by the API and cannot be modified by clients. A transfer object can have the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| id   | URI | Resource identifier |
| ledger | URI | The ledger where the transfer will take place |
| debits | Array | Funds that go into the transfer |
| debits[].account | URI | Account holding the funds |
| debits[].amount | String | Amount as decimal |
| debits[].invoice | URI | *Optional* Unique invoice URI |
| debits[].memo | Object | *Optional* Additional information related to the debit |
| debits[].authorized | Boolean | *Optional* Indicates whether the debit has been authorized by the required account holder |
| debits[].rejected | Boolean | *Optional* Indicates whether debit has been rejected by account holder |
| debits[].rejection_message | String | *Optional* Reason the debit was rejected |
| credits | Array | Funds that come out of the transfer |
| credits[].account | URI | Account receiving the funds |
| credits[].amount | String | Amount as decimal |
| credits[].invoice | URI | *Optional* Unique invoice URI |
| credits[].memo | Object | *Optional* Additional information related to the credit |
| credits[].authorized | Boolean | *Optional* Indicates whether the credit has been authorized by the required account holder |
| credits[].rejected | Boolean | *Optional* Indicates whether credit has been rejected by account holder |
| credits[].rejection_message | String | *Optional* Reason the credit was rejected |
| execution_condition | String | The condition for executing the transfer | 
| expires_at | DateTime | Time when the transfer expires. If the transfer has not executed by this time, the transfer is canceled. |
| state | String | *Optional, Read-only* The current state of the transfer (informational only) |
| timeline | Object | *Optional, Read-only* Timeline of the transfer's state transitions |
| timeline.prepared_at | DateTime | *Optional* An informational field added by the ledger to indicate when the transfer was originally prepared |
| timeline.executed_at | DateTime | *Optional* An informational field added by the ledger to indicate when the transfer was originally executed |

### Account Object

An account represents a DFSP's position at the central ledger.

Some fields are Read-only, meaning they are set by the API and cannot be modified by clients. An account object can have the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | URI | *Read-only* Resource identifier |
| name | String | Unique name of the account |
| password | String | Password for the account |
| balance | String | *Optional, Read-only* Balance as decimal |
| is_disabled | Boolean | *Optional, Read-only* Admin users may disable/enable an account |
| ledger | URI | *Optional, Read-only* A link to the account's ledger |
| created | DateTime | *Optional, Read-only* Time when account was created |

### User Object

An user represents an admin for the central ledger.

Some fields are Read-only, meaning they are set by the API and cannot be modified by clients. An user object can have the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| userId | URI | *Read-only* User identifier |
| firstName | String | First name of the account |
| lastName | String | Last name for the account |
| email | String | Email as a string |
| isActive | Boolean | *Optional* Users may be disabled/enabled |
| createdDate | DateTime | *Optional, Read-only* Time when account was created |

### Notification Object

The central ledger pushes a notification object to WebSocket clients when a transfer changes state. This notification is sent at most once for each state change. 

A notification object can have the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| resource | Object | [Transfer object](#transfer-object) that is the subject of the notification |
| related_resources | Object | *Optional* Additional resources relevant to the event |
| related\_resources.execution\_condition_fulfillment | String | *Optional* Proof of condition completion |
| related\_resources.cancellation\_condition_fulfillment | String | *Optional* Proof of condition completion |

### Metadata Object

The central ledger will return a metadata object about itself allowing client's to configure themselves properly.

A metadata object can have the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| currency_code | String | Three-letter ([ISO 4217](http://www.xe.com/iso4217.php)) code of the currency this ledger tracks |
| currency_symbol | String | Currency symbol to use in user interfaces for the currency represented in this ledger. For example, "$" |
| ledger | URI | The ledger that generated the metadata |
| urls | Object | Paths to other methods exposed by this ledger. Each field name is short name for a method and the value is the path to that method. |
| precision | Integer | How many total decimal digits of precision this ledger uses to represent currency amounts |
| scale | Integer | How many digits after the decimal place this ledger supports in currency amounts |

### Position Object

The central ledger can report the current positions for all registered accounts.

A position object can have the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | URI | A link to the account for the calculated position |
| payments | String | Total non-settled amount the account has paid as string |
| receipts | String | Total non-settled amount the account has received as string |
| net | String | Net non-settled amount for the account as string |

### Charge Object

A charge represents a fee that will be applied on a transfer at execution

A charge object can have the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | Integer | Identifier for the charge |
| name | String | Unique name of the charge |
| charge_type | String | The type of the charge, should be *fee* |
| rate_type | String | The rate type for the charge, either *flat* or *percent* |
| rate | String | The amount for the charge, represented as a *decimal for the percent rate type (5% is 0.05)* and as the *actual value for the flat rate type* |
| minimum | String | Minimum transfer amount for the charge to be applied |
| maximum | String | Maximum transfer amount for the charge to be applied |
| code | String | The letter code used to identify the charge |
| is_active | Boolean | Admin users may activate or deactive the charge |
| payer | String | The account that pays the fee generated by the charge either *sender*, *receiver*, or *ledger* |
| payee | String | The account that receives the fee generated by the charge either *sender*, *receiver*, or *ledger* |

### Permission Object

The central-ledger uses permissions to manage the capabilities of an admin.

A permission object has the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | String | The key for the permission |
| description | String | A description of the permission |

### Role Object

The central-ledger uses roles to manage sets of permissions of an admin.

A role object has the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| roleId | String | Identifier for the role |
| name | String | Name of the role |
| description | String | Description of the role |
| permissions | Array | A list of permission keys |

***

## Error Information

This section identifies the potential errors returned and the structure of the response.

An error object can have the following fields:

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | String | An identifier for the type of error |
| message | String | A message describing the error that occurred |
| validationErrors | Array | *Optional* An array of validation errors |
| validationErrors[].message | String | A message describing the validation error |
| validationErrors[].params | Object | An object containing the field that caused the validation error |
| validationErrors[].params.key | String | The name of the field that caused the validation error |
| validationErrors[].params.value | String | The value that caused the validation error |
| validationErrors[].params.child | String | The name of the child field |

``` http
HTTP/1.1 404 Not Found
Content-Type: application/json
{
  "id": "InvalidUriParameterError",
  "message": "Error validating one or more uri parameters",
  "validationErrors": [
    {
      "message": "id must be a valid GUID",
      "params": {
        "value": "7d4f2a70-e0d6-42dc-9efb-6d23060ccd6",
        "key": "id"
      }
    }
  ]
}
```

/
