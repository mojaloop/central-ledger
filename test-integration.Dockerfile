FROM node:14.15.0-alpine
USER root

WORKDIR /opt/central-ledger

RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake \
  && cd $(npm root -g)/npm \
  && npm config set unsafe-perm true \
  && npm install -g node-gyp tape tap-xunit \
  && apk --no-cache add git \
  && apk add wget

COPY package.json package-lock.json* /opt/central-ledger/
RUN npm install

RUN apk del build-dependencies

COPY src /opt/central-ledger/src
COPY config /opt/central-ledger/config
COPY migrations /opt/central-ledger/migrations
COPY seeds /opt/central-ledger/seeds
COPY test /opt/central-ledger/test
COPY tb /opt/central-ledger/tb

# overwrite default.json with integration environment specific config
RUN cp -f /opt/central-ledger/test/integration-config.json /opt/central-ledger/config/default.json

EXPOSE 3001
CMD ["/opt/central-ledger/server.sh"]
