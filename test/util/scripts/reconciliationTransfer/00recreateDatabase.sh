#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting script to recreate central-ledger db schema."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

docker exec -it $DB_ID mysql -ucentral_ledger -ppassword -e "DROP SCHEMA central_ledger;"
docker exec -it $DB_ID mysql -ucentral_ledger -ppassword -e "CREATE SCHEMA central_ledger DEFAULT CHARACTER SET utf8;"
cd /Users/georgi/mb/mojaloop/central-ledger
npm run migrate
cd $CWD
