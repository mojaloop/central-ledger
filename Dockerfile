FROM node:16.15.0-alpine as builder
WORKDIR /opt/app

RUN apk --no-cache add git
RUN apk add --no-cache -t build-dependencies make gcc g++ python3 libtool libressl-dev openssl-dev autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/app/

RUN npm ci

COPY src /opt/app/src
COPY config /opt/app/config
COPY migrations /opt/app/migrations
COPY seeds /opt/app/seeds
COPY test /opt/app/test

FROM node:16.15.0-alpine
WORKDIR /opt/app

# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
RUN ln -sf /dev/stdout ./logs/combined.log

# Create a non-root user: ml-user
RUN adduser -D ml-user 
USER ml-user

COPY --chown=ml-user --from=builder /opt/app .
RUN npm prune --production

EXPOSE 3001
CMD ["npm", "run", "start"]
