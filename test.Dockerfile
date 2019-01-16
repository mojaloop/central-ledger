FROM mhart/alpine-node:8.9.4
USER root

WORKDIR /opt/central-ledger
COPY src /opt/central-ledger/src

COPY test /opt/central-ledger/test
COPY migrations /opt/central-ledger/migrations
COPY seeds /opt/central-ledger/seeds
COPY config /opt/central-ledger/config
COPY package.json server.sh /opt/central-ledger/

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp \
    && apk --no-cache add git

RUN npm install -g tape tap-xunit \
    && npm install

RUN apk del build-dependencies

EXPOSE 3000
# Create empty log file
RUN touch ./log/combined.log

# Link the stdout to the application log file
RUN ln -sf /dev/stdout ./log/combined.log
CMD ["/opt/central-ledger/server.sh"]
