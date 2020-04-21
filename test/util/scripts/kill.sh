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

$CWD/killDb.sh;

$CWD/killKafka-johnnypark.sh;

$CWD/killMockServer.sh;

$CWD/killObjStore.sh;
