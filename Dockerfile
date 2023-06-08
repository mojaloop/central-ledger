FROM node:16.15.0-alpine as builder
WORKDIR /opt/app

RUN apk --no-cache add git
RUN apk add --no-cache -t build-dependencies make gcc g++ python3 libtool libressl-dev openssl-dev autoconf automake wget \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/app/

RUN npm ci

COPY src /opt/app/src
COPY config /opt/app/config
COPY migrations /opt/app/migrations
COPY seeds /opt/app/seeds
COPY test /opt/app/test
COPY tb /opt/app/tb

# TigerBeetle
## Init
#RUN whoami

#WORKDIR /opt/central-ledger/tb
#USER root
#RUN ./tb/tigerbeetle init --cluster=0 --replica=0 --directory=./tb
#RUN ./tb/tigerbeetle init --cluster=0 --replica=1 --directory=./tb
#RUN ./tb/tigerbeetle init --cluster=0 --replica=2 --directory=./tb
RUN ls -ltra /opt/app/tb
RUN ls -ltra /opt/app
RUN cp /opt/app/test/run_test_integration.sh /opt/app/run_tests.sh
RUN chmod 777 /opt/app/run_tests.sh

#RUN chmod 777 *

## Start
#USER node

#WORKDIR /opt/central-ledger


FROM node:16.15.0-alpine
WORKDIR /opt/app

# CL Core
# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
RUN ln -sf /dev/stdout ./logs/combined.log

# Create a non-root user: ml-user
RUN adduser -D ml-user 
USER ml-user

COPY --chown=ml-user --from=builder /opt/app .
RUN npm prune --production

# Start TB
#RUN ./tb/tigerbeetle start --cluster=0 --replica=0 --directory=tb --addresses=5001,5002,5003 &> tb-r-1.log &
#RUN ./tb/tigerbeetle start --cluster=0 --replica=1 --directory=tb --addresses=5001,5002,5003 &> tb-r-2.log &
#RUN ./tb/tigerbeetle start --cluster=0 --replica=2 --directory=tb --addresses=5001,5002,5003 &> tb-r-3.log &

# Node
EXPOSE 3001

# TigerBeetle
EXPOSE 5001
EXPOSE 5002
EXPOSE 5003

CMD ["npm", "run", "start"]
