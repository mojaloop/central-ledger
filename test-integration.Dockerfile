FROM mhart/alpine-node:8.9.4
USER root

WORKDIR /opt/central-ledger
COPY src /opt/central-ledger/src

# This to be updated to 'COPY test /opt/central-ledger/test' once the integration tests are fully resolved
COPY testPI2 /opt/central-ledger/test
COPY migrations /opt/central-ledger/migrations
COPY seeds /opt/central-ledger/seeds
COPY config /opt/central-ledger/config
COPY package.json server.sh /opt/central-ledger/

# overwrite default.json with integration environment specific config
RUN cp -f /opt/central-ledger/test/integration-config.json /opt/central-ledger/config/default.json

RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm install -g node-gyp \
    && apk --no-cache add git

RUN npm install -g tape tap-xunit \
    && npm install

RUN apk del build-dependencies

EXPOSE 3000
CMD ["/opt/central-ledger/server.sh"]
