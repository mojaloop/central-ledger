#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting Database Restart Script..."
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
echo " Creating ${DB_ID} Instance"
echo "---------------------------------------------------------------------"
echo "Destroying ${DB_ID}"

docker stop $DB_ID
docker rm $DB_ID

echo "Starting Docker ${DB_ID}"
docker run -p 3306:3306 -d --name ${DB_ID} -e MYSQL_USER=$DBUSER -e MYSQL_PASSWORD=$DBPASS -e MYSQL_DATABASE=$DBNAME -e MYSQL_ALLOW_EMPTY_PASSWORD=true mysql/mysql-server;

sleep $DB_SLEEPTIME;

docker exec -it $DB_ID mysql -uroot -e "ALTER USER '$DBUSER'@'%' IDENTIFIED WITH mysql_native_password BY '$DBPASS';"

echo
echo "Sleeping for ${SLEEP_FACTOR_IN_SECONDS}s for ${DB_ID} startup..."
sleep $SLEEP_FACTOR_IN_SECONDS
echo

echo "${DB_ID} ready to accept requests..."
