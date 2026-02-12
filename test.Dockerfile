# Arguments
ARG NODE_VERSION=lts-alpine

# Build Image
FROM node:${NODE_VERSION} AS builder

USER root

WORKDIR /opt/app

RUN apk --no-cache add git
RUN apk add --no-cache -t build-dependencies make gcc g++ python3 libtool openssl-dev autoconf automake bash \
    && cd $(npm root -g)/npm \
    && npm install -g node-gyp tape tap-xunit

COPY package.json package-lock.json* /opt/app/
RUN npm install

RUN apk del build-dependencies

COPY src /opt/app/src
COPY config /opt/app/config
COPY test /opt/app/test

EXPOSE 3001
CMD ["npm", "start"]
