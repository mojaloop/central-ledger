FROM node:10.15.3-alpine
WORKDIR /opt/central-ledger

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/central-ledger/
RUN npm install --production

RUN apk del build-dependencies

COPY src /opt/central-ledger/src
COPY config /opt/central-ledger/config
COPY migrations /opt/central-ledger/migrations
COPY seeds /opt/central-ledger/seeds

EXPOSE 3001
CMD ["npm", "run", "start"]
