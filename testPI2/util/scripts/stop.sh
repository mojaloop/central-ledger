#!/usr/bin/env bash

echo "---------------------------------------------------------------------"
echo "Stopping all services..."
echo "---------------------------------------------------------------------"
echo

CWD=$(dirname $(cd "$(dirname "$BASH_SOURCE")"; pwd))

sh $CWD/$SCRIPT_DIR/stopDb.sh ;

sh $CWD/$SCRIPT_DIR/stopKafka-johnnypark.sh;

sh $CWD/$SCRIPT_DIR/stopMockServer.sh

echo
