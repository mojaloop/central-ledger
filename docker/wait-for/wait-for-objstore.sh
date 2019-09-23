#!/bin/sh

echo "** STARTUP - Checking for Object Store connection..."

source /opt/wait-for/wait-for.env

apk add --no-cache mongodb

#sh /opt/wait-for/wait-for.sh objstore:1080 -- echo "** STARTUP - Object Store connection successful!"
until result=$(mongo $WAIT_FOR_DB_OBJSTORE_URI --eval "db.adminCommand('ping')") && eval 'echo is_connected=$result' && if [ -z $result ]; then false; fi && if [ $result -ne 1 ]; then false; fi; do echo waiting for ObjStore; sleep 2; done;

echo "** STARTUP - Object Store connection successful!"
