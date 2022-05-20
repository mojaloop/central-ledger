FROM node:14.15.0-alpine AS builder
WORKDIR /opt/central-ledger

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/central-ledger/

RUN npm install

COPY src /opt/central-ledger/src
COPY config /opt/central-ledger/config
COPY migrations /opt/central-ledger/migrations
COPY seeds /opt/central-ledger/seeds
COPY test /opt/central-ledger/test
COPY tb /opt/central-ledger/tb

# TigerBeetle
## Init
#RUN whoami

#WORKDIR /opt/central-ledger/tb
#USER root
#RUN ./tigerbeetle init --cluster=1 --replica=0 --directory=.
#RUN ./tigerbeetle init --cluster=1 --replica=1 --directory=.
#RUN ./tigerbeetle init --cluster=1 --replica=2 --directory=.
RUN ls -ltra /opt/central-ledger/tb
RUN ls -ltra /opt/central-ledger
RUN cp /opt/central-ledger/test/run_test_integration.sh /opt/central-ledger/run_tests.sh
RUN chmod 777 /opt/central-ledger/run_tests.sh

#RUN chmod 777 *

## Start
#USER node

#WORKDIR /opt/central-ledger

FROM node:14.15.0-alpine
WORKDIR /opt/central-ledger

# CL Core
# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
RUN ln -sf /dev/stdout ./logs/combined.log

# Create a non-root user: ml-user
RUN adduser -D ml-user
USER ml-user

COPY --chown=ml-user --from=builder /opt/central-ledger .
RUN npm prune --production

# Start TB
#RUN ./tb/tigerbeetle start --cluster=1 --replica=0 --directory=tb --addresses=5001,5002,5003 &> tb-r-1.log &
#RUN ./tb/tigerbeetle start --cluster=1 --replica=1 --directory=tb --addresses=5001,5002,5003 &> tb-r-2.log &
#RUN ./tb/tigerbeetle start --cluster=1 --replica=2 --directory=tb --addresses=5001,5002,5003 &> tb-r-3.log &

# Node
EXPOSE 3001

# TigerBeetle
EXPOSE 5001
EXPOSE 5002
EXPOSE 5003

CMD ["npm", "run", "start"]
