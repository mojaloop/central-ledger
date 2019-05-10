FROM mhart/alpine-node:10.15.1

WORKDIR /opt/central-ledger
COPY . /opt/central-ledger

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

RUN npm install --production

RUN apk del build-dependencies

EXPOSE 3001
CMD npm run start
