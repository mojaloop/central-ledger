FROM mhart/alpine-node:8.9.4

WORKDIR /opt/central-ledger
COPY src /opt/central-ledger/src
COPY config /opt/central-ledger/config
COPY seeds /opt/central-ledger/seeds
COPY migrations /opt/central-ledger/migrations
COPY test /opt/central-ledger/test
COPY package.json /opt/central-ledger/


RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

RUN npm install --production && \
  npm uninstall -g npm

RUN apk del build-dependencies

EXPOSE 3000
CMD node src/api/index.js
