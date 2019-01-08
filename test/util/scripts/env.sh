#!/usr/bin/env bash
if [ -z ${MOJA_HUB_COLOUR} ];
then
    export KAFKA_ID=kafka
    export MOCKSERVER_ID=mockserver
    export DB_ID=mysql
    export SLEEP_FACTOR_IN_SECONDS=5
    export DBUSER=central_ledger
    export DBPASS=password
    export DBNAME=central_ledger
    export DB_SLEEPTIME=15
    export MESSAGES_BATCH_SIZE=1000
    export SCRIPT_DIR=scripts
    export FSPList=("dfsp1" "dfsp2")
    export DEFAULT_NET_DEBIT_CAP=1000
    export CENTRAL_LEDGER_ADMIN_URI_PREFIX=http
    export CENTRAL_LEDGER_ADMIN_HOST=localhost
    export CENTRAL_LEDGER_ADMIN_PORT=3001
    export CENTRAL_LEDGER_ADMIN_BASE=/
elif [[ ${MOJA_HUB_COLOUR} = "BLUE" ]];
then
    export CLEDG_DATABASE_URI=mysql://central_ledger:password@localhost:3306/central_ledger_blue_moja
    export KAFKA_ID=kafka_blue
    export KAFKA_PORT=9092
    export ZOOKEEPER_PORT=2181
    export MOCKSERVER_ID=mockserver_blue_moja
    export MOCKSERVER_PORT=1080
    export DB_ID=mysql_blue_moja
    export SLEEP_FACTOR_IN_SECONDS=5
    export DBUSER=central_ledger
    export DBPASS=password
    export DBNAME=central_ledger_blue_moja
    export DBPORT=3306
    export DB_SLEEPTIME=15
    export MESSAGES_BATCH_SIZE=1000
    export SCRIPT_DIR=scripts
    export FSPList=("moja.za.blue.zar.green")
    export DEFAULT_NET_DEBIT_CAP=1000
    export CENTRAL_LEDGER_ADMIN_URI_PREFIX=http
    export CENTRAL_LEDGER_ADMIN_HOST=localhost
    export CENTRAL_LEDGER_ADMIN_PORT=3001
    export CENTRAL_LEDGER_ADMIN_BASE=/
    export CNP_PORT=1082
    export CNP_NAME="moja.superremit"
elif [[ ${MOJA_HUB_COLOUR} = "RED" ]];
then
    # Red Moja
    export CLEDG_DATABASE_URI=mysql://central_ledger:password@localhost:3307/central_ledger_red_moja
    export KAFKA_ID=kafka_red
    export KAFKA_PORT=9093
    export ZOOKEEPER_PORT=2182
    export MOCKSERVER_ID=mockserver_red_moja
    export MOCKSERVER_PORT=1081
    export DB_ID=mysql_red_moja
    export SLEEP_FACTOR_IN_SECONDS=5
    export DBUSER=central_ledger
    export DBPASS=password
    export DBNAME=central_ledger_red_moja
    export DBPORT=3307
    export DB_SLEEPTIME=15
    export MESSAGES_BATCH_SIZE=1000
    export SCRIPT_DIR=scripts
    export FSPList=("moja.tz.red.tzs.pink")
    export DEFAULT_NET_DEBIT_CAP=1000
    export CENTRAL_LEDGER_ADMIN_URI_PREFIX=http
    export CENTRAL_LEDGER_ADMIN_HOST=localhost
    export CENTRAL_LEDGER_ADMIN_PORT=3002
    export CENTRAL_LEDGER_ADMIN_BASE=/
    export CNP_PORT=1083
    export CNP_NAME="moja.superremit"
fi
