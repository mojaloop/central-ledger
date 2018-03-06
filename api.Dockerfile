FROM mhart/alpine-node:8.9.4
USER root

WORKDIR /opt/central-ledger
COPY src /opt/central-ledger/src
COPY migrations /opt/central-ledger/migrations
COPY config /opt/central-ledger/config
COPY package.json server.sh /opt/central-ledger/

RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm install -g node-gyp \
    && npm install -g sodium@2.0.3 --unsafe-perm \
    && npm install -g argon2@0.17.1 --unsafe-perm \
    && apk --no-cache add git

RUN npm link sodium && \
  npm link argon2 && \
  npm install --production && \
  npm uninstall -g npm

RUN apk del build-dependencies

EXPOSE 3000
CMD node src/api/index.js
