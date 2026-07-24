

ml-api-adapter

  |
  v

  MESSAGING
    |                     ^
    |  consume(batch)     | 1. Emit notifications
    |                     | 2. commit(batch)
    |                     |
    V                     |
    DispatchTransferHandler
      |
      | ->  PaymentPrepare
      | ->  PaymentFulfil
      | ->  ForexPrepare
      | ->  ForexFulfil


## Proxy Implementation Notes



prepare + fx:

prepare()
 -> forwardPrepare()
      If fx
        Lookup the forex.
          If not found, emit an error message. return

        Found forex. State must be "RESERVED"
          update the state to RESERVED_FORWARDED
          I don't think we send any message.

    looks the same for not fx.


Ok I think the forwareded messages are only for prepares, since on the fulfil path, we look at the
payment/forex state to determine if it's forwarded (I'm only 60% sure).


The tricky thing is going to be cleaning up and reimlementing this cyril stuff. There's a ton of
opaque business logic in there, that will touch the ledger, but I don't exactly know how.


```js
const prepare = async (error, messages) => {
  ...
  // Check if message is forwarded or not.

  if (isForwarded) forwardPrepare()


}
```



Questions:
- for the prepare + fx + forwarded case, how is it that the forex first gets created?