FROM node:16.15.0-alpine
USER root

WORKDIR /opt/app

RUN apk --no-cache add git
RUN apk add --no-cache -t build-dependencies make gcc g++ python3 libtool libressl-dev openssl-dev autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/app/
RUN npm install

RUN apk del build-dependencies

COPY src /opt/app/src
COPY config /opt/app/config
COPY migrations /opt/app/migrations
COPY seeds /opt/app/seeds
COPY test /opt/app/test

# overwrite default.json with integration environment specific config
RUN cp -f /opt/app/test/integration-config.json /opt/app/config/default.json

EXPOSE 3001
CMD ["npm", "start"]
