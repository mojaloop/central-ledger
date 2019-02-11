FROM mhart/alpine-node:10.15.1
USER root

WORKDIR /opt/central-ledger
COPY src /opt/central-ledger/src

COPY test /opt/central-ledger/test
COPY migrations /opt/central-ledger/migrations
COPY seeds /opt/central-ledger/seeds
COPY config /opt/central-ledger/config
COPY package.json server.sh /opt/central-ledger/

# overwrite default.json with integration environment specific config
RUN cp -f /opt/central-ledger/test/integration-config.json /opt/central-ledger/config/default.json

RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp \
    && apk --no-cache add git

RUN npm install -g tape tap-xunit \
    && npm install

RUN apk del build-dependencies

EXPOSE 3001
CMD ["/opt/central-ledger/server.sh"]
