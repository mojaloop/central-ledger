FROM dwolla/alpine-node-make

WORKDIR /opt/central-ledger
COPY . /opt/central-ledger

RUN apk --no-cache add git
RUN npm link sodium && \
  npm link argon2 && \
  npm install && \
  npm install -g tape tap-xunit

EXPOSE 3000
CMD bin/sh -c
