#!/usr/bin/env bash

CWD=$(dirname $(cd "$(dirname "$BASH_SOURCE")"; pwd))

echo "Loading env vars..."
source $CWD/$SCRIPT_DIR/env.sh

docker logs -f $MOCKSERVER_ID
