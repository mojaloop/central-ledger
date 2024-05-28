# Arguments
ARG NODE_VERSION=lts-alpine

# NOTE: Ensure you set NODE_VERSION Build Argument as follows...
#
# export NODE_VERSION="$(cat .nvmrc)-alpine"
# docker build \
#   --build-arg NODE_VERSION=$NODE_VERSION \
#   -t mojaloop/central-ledger:local \
#   .
#

# Build Image
FROM node:${NODE_VERSION} as builder

WORKDIR /opt/app

RUN apk --no-cache add git
RUN apk add --no-cache -t build-dependencies make gcc g++ python3 libtool openssl-dev autoconf automake bash \
    && cd $(npm root -g)/npm \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/app/

RUN npm ci

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

RUN npm prune --production

EXPOSE 3001
CMD ["npm", "run", "start"]
