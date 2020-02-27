FROM node:12.16.0-alpine as builder
WORKDIR /opt/central-ledger

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

## Main central-services-stream project
COPY package.json package-lock.json /opt/central-ledger/
# COPY src /opt/central-ledger/src
# COPY config /opt/central-ledger/config

## Perf scripts for central-services-stream project
# COPY test/perf/config /opt/central-ledger/test/perf/config
# COPY test/perf/src /opt/central-ledger/test/perf/src
COPY test/perf/package.json /opt/central-ledger/test/perf/package.json
COPY test/perf/package-lock.json /opt/central-ledger/test/perf/package-lock.json

RUN npm install

WORKDIR /opt/central-ledger/test/perf

RUN npm install

FROM node:12.16.0-alpine
WORKDIR /opt/central-ledger

COPY --from=builder /opt/central-ledger .

# RUN npm prune --production

## Central Ledger code-base
COPY src /opt/central-ledger/src
COPY seeds /opt/central-ledger/seeds
COPY migrations /opt/central-ledger/migrations
COPY config /opt/central-ledger/config

## Central Ledger Perf Test Scripts
COPY test/perf/src /opt/central-ledger/test/perf/src


# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
RUN ln -sf /dev/stdout ./logs/combined.log

WORKDIR /opt/central-ledger/test/perf
EXPOSE 3001
CMD node src/index.js perf-prepare --numberOfMsgs 10
