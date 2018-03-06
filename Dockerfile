FROM mhart/alpine-node:8.9.4

WORKDIR /opt/central-ledger
COPY . /opt/central-ledger

RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm install fs-extra \
    && sed -i -e s/graceful-fs/fs-extra/ -e s/fs.rename/fs.move/ ./lib/utils/rename.js \
    && npm install -g node-gyp \
    && npm install -g sodium@1.2.3 --unsafe-perm \
    && npm install -g argon2@0.14.0 --unsafe-perm

RUN npm link sodium && \
  npm link argon2 && \
  npm install --production && \
  npm uninstall -g npm

RUN apk del build-dependencies

EXPOSE 3000
CMD node src/api/index.js
