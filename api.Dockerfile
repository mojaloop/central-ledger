FROM mhart/alpine-node:8.9.4
USER root

WORKDIR /opt/central-ledger
COPY src /opt/central-ledger/src
COPY migrations /opt/central-ledger/migrations
COPY seeds /opt/central-ledger/seeds
COPY config /opt/central-ledger/config
COPY package.json server.sh /opt/central-ledger/

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm install -g node-gyp \
    && apk --no-cache add git

RUN npm install --production && \
  npm uninstall -g npm

RUN apk del build-dependencies

EXPOSE 3000
CMD node src/api/index.js
