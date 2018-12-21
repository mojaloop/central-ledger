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
docker volume rm ${DB_ID}data

echo "Starting Docker ${DB_ID}"
docker run -p ${DBPORT}:3306 -d --name ${DB_ID} -v ${DB_ID}data:/var/lib/mysql -e MYSQL_USER=$DBUSER -e MYSQL_PASSWORD=$DBPASS -e MYSQL_DATABASE=$DBNAME -e MYSQL_ALLOW_EMPTY_PASSWORD=true mysql/mysql-server;

sleep $DB_SLEEPTIME;

is_db_up() {
  docker exec -it ${DB_ID} mysql -uroot -e "select 1"
}

echo "Waiting for DB to start"
until is_db_up; do
  printf "."
  sleep $SLEEP_FACTOR_IN_SECONDS
done

docker exec -it ${DB_ID} mysql -uroot -e "ALTER USER '$DBUSER'@'%' IDENTIFIED WITH mysql_native_password BY '$DBPASS';"

echo "${DB_ID} ready to accept requests..."
