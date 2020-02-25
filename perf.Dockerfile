FROM node:10.15.3-alpine as builder
WORKDIR /opt/app

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

# Main central-services-stream project
COPY package.json package-lock.json /opt/app/
COPY src /opt/app/src
COPY config /opt/app/config

# Perf scripts for central-services-stream project
# COPY test/perf/config /opt/app/test/perf/config
COPY test/perf/src /opt/app/test/perf/src
COPY test/perf/package.json /opt/app/test/perf/package.json
COPY test/perf/package-lock.json /opt/app/test/perf/package-lock.json

# RUN npm install

WORKDIR /opt/app/test/perf

RUN npm install

FROM node:10.15.3-alpine
WORKDIR /opt/app

COPY --from=builder /opt/app .

# RUN npm prune --production


# Create empty log file & link stdout to the application log file
# RUN mkdir ./logs && touch ./logs/combined.log
# RUN ln -sf /dev/stdout ./logs/combined.log
WORKDIR /opt/app/test/perf
EXPOSE 3001
CMD ["node", "src/index.js" "perf-prepare", "--numberOfMsgs", "10"]
