#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting Object Store Restart Script..."
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
echo " Creating ${OBJ_ID} Instance"
echo "---------------------------------------------------------------------"
echo "Destroying ${OBJ_ID}"

docker stop $OBJ_ID
docker rm $OBJ_ID
docker volume rm ${OBJ_ID}data

echo "Starting Docker ${OBJ_ID}"
docker run --name ${OBJ_ID} -p 27017:27017 -v ${DB_ID}data:/etc/mongo -d mongo:latest

sleep $DB_SLEEPTIME;

is_up() {
  curl http://localhost:27017/ --silent --output /dev/null
}

echo "Waiting for Obj Store to start"
until is_up; do
  printf "."
  sleep $SLEEP_FACTOR_IN_SECONDS
done

echo "${OBJ_ID} ready to accept requests..."
