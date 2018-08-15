#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting Database Kill Script..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

echo
echo "---------------------------------------------------------------------"
echo " Stopping ${DB_ID} Instance"
echo "---------------------------------------------------------------------"
echo "Destroying ${DB_ID}"

docker stop $DB_ID
docker rm $DB_ID
