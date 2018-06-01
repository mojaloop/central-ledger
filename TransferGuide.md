# Working with Transfers
***

## Introduction
In this guide, we'll walk through the different steps of successfully executing a transfer:
* [**Creating accounts**](#step-1-creating-accounts)
* [**Preparing a transfer**](#step-2-preparing-a-transfer) 
* [**Executing a transfer**](#step-3-executing-a-transfer)
* [**Next Steps**](#next-steps)

***

## Step 1: Creating accounts
To get started, you'll need to create two accounts, one to credit to and one to debit from.  

### Create account **dfsp1**
Start off by creating an account with the name **dfsp1**. Simply provide the account's name and password then make a call to the create account endpoint. More detail about the response and errors can be found in the [API documentation.](API.md#create-account)

#### Request
```
POST http://central-ledger/accounts
Content-Type: application/json
{
  "name": "dfsp1",
  "password": "dfsp1_password"
}
```

#### Response
```
HTTP/1.1 201 Created
{
  "id": "http://central-ledger/accounts/dfsp1",
  "name": "dfsp1",
  "created": "2017-01-03T22:29:46.068Z",
  "balance": "0",
  "is_disabled": false,
  "ledger": "http://central-ledger"
}
```

### Create account **dfsp2**
Next, create an account with the name **dfsp2**. Like before, provide the account's name and password then make a call to the create account endpoint.

#### Request
```
POST http://central-ledger/accounts HTTP/1.1
Content-Type: application/json
{
  "name": "dfsp2",
  "password": "dfsp2_password"
}
```

#### Response
```
HTTP/1.1 201 Created
{
  "id": "http://central-ledger/accounts/dfsp1",
  "name": "dfsp2",
  "created": "2017-01-03T22:30:46.068Z",
  "balance": "0",
  "is_disabled": false,
  "ledger": "http://central-ledger"
}
```

## Step 2: Preparing a transfer
Now that you have two accounts created, a transfer can be prepared. For this transfer, you will be debiting 100 from **dfsp1** and crediting it to **dfsp2**. There are quite a few optional fields that can be passed on a transfer prepare call. For now, you can stick to the minimum. A more in depth explanation can be found in the [API documentation.](API.md)

#### Request
```
PUT http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204 HTTP/1.1
Content-Type: application/json
{
    "id": "http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204",
    "ledger": "http://central-ledger",
    "debits": [{
      "account": "http://central-ledger/accounts/dfsp1",
      "amount": "100"
    }],
    "credits": [{
      "account": "http://central-ledger/accounts/dfsp2",
      "amount": "100"
    }],
    "execution_condition": "ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0",
    "expires_at": "2017-12-31T00:00:01.000Z"
  }
```

#### Response
```
HTTP/1.1 201 Created
{
  "id": "http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204",
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
  "expires_at": "2017-12-31T00:00:01.000Z",
  "state": "prepared",
  "timeline": {
    "prepared_at": "2017-01-01T22:43:41.385Z"
  }
}
```

## Step 3: Executing a transfer
Now that the transfer is prepared, you are free to execute the transfer. This consists of either fulfilling or cancelling the transfer. For this example, you will be fulfilling the transfer, because the transfer was prepared with an execution\_condition as opposed to a cancellation\_condition. Like before, more information can be found in the [API documentation.](API.md) 

#### Request
```
PUT http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfilment HTTP/1.1
Content-Type: text/plain
oAKAAA
```

#### Response
```
HTTP/1.1 200 OK
oAKAAA
```


## Next Steps
Now that you have succesfully created accounts and prepared and executed a transfer, you should feel comfortable working with the other endpoints found in the [API documentation.](API.md)
