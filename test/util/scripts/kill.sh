#!/usr/bin/env bash

echo "---------------------------------------------------------------------"
echo "Killing all services..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

sh $CWD/killDb.sh ;

sh $CWD/killKafka-johnnypark.sh;

sh $CWD/killMockServer.sh

sh $CWD/killObjStore.sh
