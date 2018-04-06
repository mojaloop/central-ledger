FROM mhart/alpine-node:8.9.4

WORKDIR /opt/central-ledger
COPY . /opt/central-ledger

RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake

RUN apk --no-cache add tzdata openntpd

RUN echo "ntpd -s" > ~/.bashrc

RUN cd $(npm root -g)/npm
RUN npm install -g node-gyp

RUN npm install --production
RUN npm uninstall -g npm

RUN apk del build-dependencies

EXPOSE 3000
CMD node src/api/index.js
