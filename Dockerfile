FROM node:18.17.1-alpine as builder
WORKDIR /opt/app

# RUN apk --no-cache add \
#       bash \
#       g++ \
#       ca-certificates \
#       lz4-dev \
#       musl-dev \
#       cyrus-sasl-dev \
#       openssl-dev \
#       make \
#       python3

# RUN apk add --no-cache --virtual .build-deps gcc zlib-dev libc-dev bsd-compat-headers py-setuptools

RUN apk --no-cache add git
RUN apk add --no-cache -t build-dependencies make gcc g++ python3 libtool openssl-dev autoconf automake bash \
    && cd $(npm root -g)/npm \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/app/

RUN npm ci

FROM node:18.17.1-alpine
WORKDIR /opt/app

# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
RUN ln -sf /dev/stdout ./logs/combined.log

# Create a non-root user: ml-user
RUN adduser -D ml-user 
USER ml-user

COPY --chown=ml-user --from=builder /opt/app .

COPY src /opt/app/src
COPY config /opt/app/config
COPY migrations /opt/app/migrations
COPY seeds /opt/app/seeds
COPY test /opt/app/test

RUN npm prune --production

EXPOSE 3001
CMD ["npm", "run", "start"]
