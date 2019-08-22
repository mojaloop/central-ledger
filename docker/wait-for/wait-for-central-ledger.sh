#!/bin/sh

echo "** STARTUP - Checking for Central-Ledger..."

source /opt/wait-for/wait-for.env

sh /opt/wait-for/wait-for-mysql.sh

sh /opt/wait-for/wait-for-kafka.sh

sh /opt/wait-for/wait-for-objstore.sh

echo "** STARTUP - Central-Ledger successful!"
