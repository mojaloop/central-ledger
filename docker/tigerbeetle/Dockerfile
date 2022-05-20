FROM tb:latest AS init

RUN ./tigerbeetle init --cluster=1 --replica=0 --directory=.
RUN ./tigerbeetle init --cluster=1 --replica=1 --directory=.
RUN ./tigerbeetle init --cluster=1 --replica=2 --directory=.

EXPOSE 5001
EXPOSE 5002
EXPOSE 5003

FROM init AS release

#docker build . -t tb_moja:latest
#docker run tb_moja:latest start --cluster=1 --replica=0 --directory=. --addresses=5001,5002,5003
