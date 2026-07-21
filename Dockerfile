# Arguments
ARG NODE_VERSION=24.18.0-alpine3.24

# NOTE: Ensure you set NODE_VERSION Build Argument as follows...
#
# export NODE_VERSION="$(cat .nvmrc)-alpine"
# docker build \
#   --build-arg NODE_VERSION=$NODE_VERSION \
#   -t mojaloop/central-ledger:local \
#   .
#

# Build Image
FROM node:${NODE_VERSION} AS builder

WORKDIR /opt/app

RUN apk --no-cache add git
RUN apk add --no-cache --virtual .build-deps autoconf automake bash g++ gcc libtool make openssl-dev py3-setuptools python3

COPY package.json package-lock.json* /opt/app/

# Lifecycle scripts are skipped for supply-chain safety (docker:S6505); node-rdkafka
# is the only production dependency that needs its native build, so run it explicitly.
RUN npm ci --ignore-scripts
RUN npm rebuild node-rdkafka
RUN npm prune --omit=dev

FROM node:${NODE_VERSION}
WORKDIR /opt/app

# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
RUN ln -sf /dev/stdout ./logs/combined.log

# Create a non-root user: ml-user
RUN adduser -D ml-user
USER ml-user

COPY --chown=ml-user --from=builder /opt/app .

COPY src /opt/app/src
COPY config /opt/app/config
COPY migrations /opt/app/migrations
COPY seeds /opt/app/seeds
COPY test /opt/app/test

EXPOSE 3001
CMD ["npm", "run", "start"]
