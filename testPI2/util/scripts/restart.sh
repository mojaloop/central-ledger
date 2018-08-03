#!/usr/bin/env bash

echo "---------------------------------------------------------------------"
echo "Restarting all services..."
echo "---------------------------------------------------------------------"
echo

CWD=$(dirname $(cd "$(dirname "$BASH_SOURCE")"; pwd))

sh $CWD/$SCRIPT_DIR/restartDb.sh ;

sh $CWD/$SCRIPT_DIR/restartKafka-johnnypark.sh;

sh $CWD/$SCRIPT_DIR/restartMockServer.sh

echo
