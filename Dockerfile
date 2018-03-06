FROM mhart/alpine-node:8.9.4

WORKDIR /opt/central-ledger
COPY . /opt/central-ledger

RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm install -g node-gyp

RUN npm install --production && \
  npm uninstall -g npm

RUN apk del build-dependencies

EXPOSE 3000
CMD node src/api/index.js
