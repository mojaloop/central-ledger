FROM mhart/alpine-node:8.9.4
USER root

WORKDIR /opt/central-ledger
COPY src /opt/central-ledger/src
COPY test /opt/central-ledger/test
COPY migrations /opt/central-ledger/migrations
COPY config /opt/central-ledger/config
COPY package.json server.sh /opt/central-ledger/

RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm install -g node-gyp \
    && apk --no-cache add git

RUN npm install -g tape tap-xunit \
    && npm install

RUN apk del build-dependencies

EXPOSE 3000
CMD ["/opt/central-ledger/server.sh"]
