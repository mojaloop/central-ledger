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
echo "=> EXPECTED RESULT: Created Hub participant and 2 dfsps."
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
echo "=> EXPECTED RESULT: Hub reconciliation and hub multilateral settlement accounts are now pre-requisites"
echo "for creating dfsp position and settlement accounts. Showing 6 records."
echo
echo

echo "TABLE transfer"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transfer ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: No transfers are yet recorded in the database."
echo
