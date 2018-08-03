#!/usr/bin/env bash

echo "---------------------------------------------------------------------"
echo "Killing all services..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

sh $CWD/stopDb.sh ;

sh $CWD/stopKafka-johnnypark.sh;

sh $CWD/stopMockServer.sh
