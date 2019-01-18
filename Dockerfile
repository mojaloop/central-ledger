FROM mhart/alpine-node:8.9.4

WORKDIR /opt/central-ledger
COPY src /opt/central-ledger/src
COPY config /opt/central-ledger/config
COPY seeds /opt/central-ledger/seeds
COPY migrations /opt/central-ledger/migrations
COPY test /opt/central-ledger/test
COPY package.json /opt/central-ledger/
COPY logs /opt/central-ledger/logs


RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

RUN npm install --production && \
  npm uninstall -g npm

RUN apk del build-dependencies

EXPOSE 3000
# Create empty log file
RUN touch ./logs/combined.log

# Link the stdout to the application log file
RUN ln -sf /dev/stdout ./logs/combined.log
CMD node src/api/index.js
