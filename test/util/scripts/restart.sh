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

bash $CWD/restartDb.sh;

bash $CWD/restartKafka-johnnypark.sh;

bash $CWD/restartMockServer.sh;

echo
