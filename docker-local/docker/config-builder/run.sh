set -e

while getopts c:o: flag
do
    case "${flag}" in
        c) CONFIG_FILE=${OPTARG};;
        o) OUT_DIR=${OPTARG};;
    esac
done
echo "Config File: $CONFIG_FILE";
echo "Out Directory: $OUT_DIR";

# Install dependencies
# apt-get update
# apt-get install -y jq curl

# Set versions
ML_API_ADAPTER_VERSION="${ML_API_ADAPTER_VERSION:-master}"
ACCOUNT_LOOKUP_SERVICE_VERSION="${ACCOUNT_LOOKUP_SERVICE_VERSION:-master}"
QUOTING_SERVICE_VERSION="${QUOTING_SERVICE_VERSION:-master}"
CENTRAL_LEDGER_VERSION="${CENTRAL_LEDGER_VERSION_VERSION:-master}"

# Generate config files

## ml-api-adapter
configUrl="https://raw.githubusercontent.com/mojaloop/ml-api-adapter/$ML_API_ADAPTER_VERSION/config/default.json"
echo -n "Getting $configUrl ..."
originalConfig=`curl -s $configUrl`
echo "Done"
overrideConfig=`cat $CONFIG_FILE |jq '."ml-api-adapter"."config"' -`
mkdir -p $OUT_DIR/ml-api-adapter
newConfig=`echo "$originalConfig  $overrideConfig" |jq -s '.[0] * .[1]' -`
echo "$newConfig" |jq . > $OUT_DIR/ml-api-adapter/default.json

## account-lookup-service
configUrl="https://raw.githubusercontent.com/mojaloop/account-lookup-service/$ACCOUNT_LOOKUP_SERVICE_VERSION/config/default.json"
echo -n "Getting $configUrl ..."
originalConfig=`curl -s $configUrl`
echo "Done"
overrideConfig=`cat $CONFIG_FILE |jq '."account-lookup-service"."config"' -`
mkdir -p $OUT_DIR/account-lookup-service
newConfig=`echo "$originalConfig  $overrideConfig" |jq -s '.[0] * .[1]' -`
echo "$newConfig" |jq . > $OUT_DIR/account-lookup-service/default.json

## quoting-service
configUrl="https://raw.githubusercontent.com/mojaloop/quoting-service/$QUOTING_SERVICE_VERSION/config/default.json"
echo -n "Getting $configUrl ..."
originalConfig=`curl -s $configUrl`
echo "Done"
overrideConfig=`cat $CONFIG_FILE |jq '."quoting-service"."config"' -`
mkdir -p $OUT_DIR/quoting-service
newConfig=`echo "$originalConfig  $overrideConfig" |jq -s '.[0] * .[1]' -`
echo "$newConfig" |jq . > $OUT_DIR/quoting-service/default.json

## central-ledger
configUrl="https://raw.githubusercontent.com/mojaloop/central-ledger/$CENTRAL_LEDGER_VERSION/config/default.json"
echo -n "Getting $configUrl ..."
originalConfig=`curl -s $configUrl`
echo "Done"
overrideConfig=`cat $CONFIG_FILE |jq '."central-ledger"."config"' -`
mkdir -p $OUT_DIR/central-ledger
newConfig=`echo "$originalConfig  $overrideConfig" |jq -s '.[0] * .[1]' -`
echo "$newConfig" |jq . > $OUT_DIR/central-ledger/default.json
