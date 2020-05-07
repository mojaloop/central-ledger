#!/bin/sh

echo "** STARTUP - Checking for Object Store connection..."

source /opt/wait-for/wait-for.env

sh /opt/wait-for/wait-for.sh $WAIT_FOR_OBJSTORE_SERVER -t 240 -- echo "** STARTUP - Object Store connection successful!"
