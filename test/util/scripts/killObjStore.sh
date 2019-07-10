#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting Object Store Kill Script..."
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
echo " Stopping ${OBJ_ID} Instance"
echo "---------------------------------------------------------------------"
echo "Destroying ${OBJ_ID}"

docker stop ${OBJ_ID}
docker rm ${OBJ_ID}
docker volume rm ${OBJ_ID}data
