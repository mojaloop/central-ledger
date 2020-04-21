#!/usr/bin/env bash

echo "---------------------------------------------------------------------"
echo "Restarting all services..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

$CWD/restartDb.sh;

$CWD/restartKafka-johnnypark.sh;

$CWD/restartMockServer.sh;

$CWD/restartObjStore.sh;

echo
