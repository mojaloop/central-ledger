#!/usr/bin/env bash

CWD="${0%/*}"

echo "Loading env vars..."
source $CWD/env.sh

docker logs -f $MOCKSERVER_ID
