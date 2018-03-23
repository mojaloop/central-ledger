# Examples of running the WSClient in Docker and Kubectl
# ---------------------------------------------------------------
#   docker rm wsclient1; docker run -it --name=wsclient1 mojaloop/wsclient:latest node wsclient.js -u ws://a02bcb8d21d2d11e8ada0027eebfb29a-160662342.eu-west-2.elb.amazonaws.com/mojapoc/websocket -a http://localhost:3000/dfsp1
#   kubectl -n mojaloop-kafka-poc run wsclient1 --image=mojaloop/wsclient:latest --restart=Never -- node wsclient.js -u ws://poc-moja-centralledger:3000/websocket -a http://localhost:3000/dfsp1
#

FROM mhart/alpine-node:8.9.4

WORKDIR /opt/tools
COPY package.json /opt/tools
COPY wsclient.js /opt/tools

RUN npm install

EXPOSE 3000
CMD node wsclient.js -u $WSCLIENT_URI -a $WSCLIENT_ACCOUNT
