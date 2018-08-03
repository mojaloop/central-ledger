#!/usr/bin/env bash

echo "---------------------------------------------------------------------"
echo "Restarting all services..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

echo "Loading env vars..."
source $CWD/env.sh

sh $CWD/restartDb.sh ;

sh $CWD/restartKafka-johnnypark.sh;

sh $CWD/restartMockServer.sh

echo
