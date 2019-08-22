#!/bin/sh

echo "** STARTUP - Checking for DB connection..."

source /opt/wait-for/wait-for.env

apk --no-cache add mysql-client

until result=$(mysql -h $WAIT_FOR_DB_HOST -P $WAIT_FOR_DB_PORT -u $WAIT_FOR_DB_USER --password=$WAIT_FOR_DB_PASSWORD  $WAIT_FOR_DB_DATABASE -ss -N -e 'select 1;') && eval 'echo is_connected=$result' && if [ -z $result ]; then false; fi && if [ $result -ne 1 ]; then false; fi; do echo waiting for MySQL; sleep 2; done;

echo "** STARTUP - DB connection successful!"
