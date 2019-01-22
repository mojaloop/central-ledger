#!/usr/bin/env bash
echo
echo "*********************************************************************"
echo "---------------------------------------------------------------------"
echo "Showing current database state"
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

source $CWD/env.sh

echo "TABLE participant"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.participant ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: All 3 participants are active."
echo
echo

echo "TABLE participantCurrency"
docker exec -it $DB_ID mysql -uroot -e "
SELECT pc.participantCurrencyId AS id,
CONCAT(pc.participantId, '-', p.name) AS participant,
pc.currencyId,
CONCAT(pc.ledgerAccountTypeId, '-', lat.name) AS ledgerAccountType,
pc.isActive, pc.createdDate, pc.createdBy
FROM central_ledger.participantCurrency pc
JOIN central_ledger.participant p
ON p.participantId = pc.participantId
JOIN central_ledger.ledgerAccountType lat
ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: All 6 accounts are active."
echo
echo

echo "TABLE transferStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transferStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Transfer was successful RECEIVED_PREPARE -> RESERVED. Showing 2 records."
echo
echo


echo "TABLE transferError"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transferError ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: No transfer errors have been recorded in the database yet."
echo
