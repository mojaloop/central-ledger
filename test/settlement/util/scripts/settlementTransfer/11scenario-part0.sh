#!/usr/bin/env bash
CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

sh $CWD/00recreateDatabase.sh
sh $CWD/01populateAdminTestData.sh
sh $CWD/21scenario-part0-results.sh
