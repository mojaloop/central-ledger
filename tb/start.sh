#!/usr/bin/env bash
./tigerbeetle start --cluster=0 --replica=0 --directory=. --addresses=5001,5002,5003 &> tb-r-1.log &
./tigerbeetle start --cluster=0 --replica=1 --directory=. --addresses=5001,5002,5003 &> tb-r-2.log &
./tigerbeetle start --cluster=0 --replica=2 --directory=. --addresses=5001,5002,5003 &> tb-r-3.log &
