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
echo "=> EXPECTED RESULT: Created Hub participant and 3 dfsps."
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
ORDER BY 1 DESC;"
echo "=> EXPECTED RESULT: Hub reconciliation and hub multilateral settlement accounts are now pre-requisites"
echo "for creating dfsp position and settlement accounts, which are created for the demo."
echo
echo

echo "TABLE participantLimit (w/ enums)"
docker exec -it $DB_ID mysql -uroot -e "
SELECT pl.participantLimitId AS id,
CONCAT(pl.participantCurrencyId, '-', p.name, '-', lat.name) AS participantCurrencyId,
CONCAT(pl.participantLimitTypeId, '-', plt.name) AS participantLimitTypeId,
pl.value, pl.thresholdAlarmPercentage, pl.startAfterParticipantPositionChangeId,
pl.isActive, pl.createdDate, pl.createdBy
FROM central_ledger.participantLimit pl
JOIN central_ledger.participantCurrency pc
ON pc.participantCurrencyId = pl.participantCurrencyId
JOIN central_ledger.ledgerAccountType lat
ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
JOIN central_ledger.participant p
ON p.participantId = pc.participantId
JOIN central_ledger.participantLimitType plt
ON plt.participantLimitTypeId = pl.participantLimitTypeId
ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Limit initiated at 1000 for all 3 dfsps."
echo
echo

echo "TABLE transfer"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transfer ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: No transfers are yet recorded in the database."
echo
