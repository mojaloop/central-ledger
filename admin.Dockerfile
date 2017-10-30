FROM dwolla/alpine-node-make

WORKDIR /opt/central-ledger
COPY . /opt/central-ledger

RUN npm link sodium && \
  npm link argon2 && \
  npm install --production && \
  npm uninstall -g npm

EXPOSE 3001
CMD node src/admin/index.js
