#!/usr/bin/env bash

echo "---------------------------------------------------------------------"
echo "Killing all services..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

sh $CWD/killDb.sh ;

sh $CWD/killKafka-johnnypark.sh;

sh $CWD/killMockServer.sh
