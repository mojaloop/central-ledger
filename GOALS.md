# Mojaloop Central Ledger using TigerBeetle
TigerBeetle drop-in for Mojaloop `central-ledger`.

See; https://github.com/mojaloop/central-ledger

# Goals

1. Drop in replacement for the Mojaloop `central-ledger` v13.x
2. Compatible with Ref 2.0 Mojaloop architecture;
    1. https://miro.com/app/board/o9J_lJyA1TA=/
    2. https://docs.mojaloop.io/reference-architecture-doc/refarch/

# Dependencies
- ~~NodeJS >= 14.0.0 (cl is currently on `12.16.0-alpine`)~~
- https://github.com/coilhq/tigerbeetle-node

# Run
```shell
git clone git@github.com:coilhq/moja-ledger-beetle.git
cd tiger-beetle/proto-beetle
npm install
dd < /dev/zero bs=1048576 count=256 > journal
scripts/create-transfers
node server

# In another tab:
cd tiger-beetle/proto-beetle
time node stress
```


