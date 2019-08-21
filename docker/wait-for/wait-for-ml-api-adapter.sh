#!/bin/sh

echo "** STARTUP - Checking for ML-API-Adapter..."

sh /opt/wait-for/wait-for-kafka.sh

echo "** STARTUP - ML-API-Adapter successful!"
