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

echo "TABLE transferDuplicateCheck"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transferDuplicateCheck ORDER BY createdDate DESC"
echo "=> EXPECTED RESULT: Nothing changed. Showing same 2 records."
echo
echo

echo "TABLE transfer"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transfer ORDER BY createdDate DESC"
echo "=> EXPECTED RESULT: Nothing changed. Showing same 2 records."
echo
echo

echo "TABLE transferFulfilment"
docker exec -it $DB_ID mysql -uroot -e "
SELECT SUBSTRING(transferId, -20) AS trasnferId_20,
SUBSTRING(transferFulfilmentId, -20) AS transferFulfilmentId_20,
ilpFulfilment, completedDate, isValid, settlementWindowId, createdDate
FROM central_ledger.transferFulfilment 
ORDER BY createdDate DESC"
echo "EXPECTED RESULT: The transfer has been fulfilled. Showing 2 records (previously 1)."
echo
echo

echo "TABLE transferParticipant (w/ enums)"
docker exec -it $DB_ID mysql -uroot -e "
SELECT tp.transferParticipantId AS id, tp.transferId, 
CONCAT(tp.participantCurrencyId, '-', p.name, '-', lat.name) AS participantCurrencyId,
CONCAT(tp.transferParticipantRoleTypeId, '-', tprt.name) AS transferParticipantRoleTypeId,
CONCAT(tp.ledgerEntryTypeId, '-', let.name) AS ledgerEntryTypeId, tp.amount, tp.createdDate
FROM central_ledger.transferParticipant tp
JOIN central_ledger.participantCurrency pc
ON pc.participantCurrencyId = tp.participantCurrencyId
JOIN central_ledger.ledgerAccountType lat
ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
JOIN central_ledger.participant p
ON p.participantId = pc.participantId
JOIN central_ledger.transferParticipantRoleType tprt
ON tprt.transferParticipantRoleTypeId = tp.transferParticipantRoleTypeId
JOIN central_ledger.ledgerEntryType let
ON let.ledgerEntryTypeId = tp.ledgerEntryTypeId
ORDER BY tp.transferParticipantId DESC"
echo "=> EXPECTED RESULT: Not changed. Showing same 4 records."
echo
echo

echo "TABLE transferParticipant TOTALS by account REGARDLESS transferState (w/ enums)"
docker exec -it $DB_ID mysql -uroot -e "
SELECT CONCAT(tp.participantCurrencyId, '-', p.name, '-', lat.name) AS participantCurrencyId, SUM(tp.amount) AS SUM_amount
FROM central_ledger.transferParticipant tp
JOIN central_ledger.participantCurrency pc
ON pc.participantCurrencyId = tp.participantCurrencyId
JOIN central_ledger.ledgerAccountType lat
ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
JOIN central_ledger.participant p
ON p.participantId = pc.participantId
GROUP BY CONCAT(tp.participantCurrencyId, '-', p.name, '-', lat.name)
ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: The total SUM_amount for transferParticipant records should be always 0."
echo
echo

echo "TABLE transferExtension"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transferExtension ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Not changed. Showing same 6 records."
echo
echo

echo "TABLE transferStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transferStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Transfer state changed to COMMITTED. Showing 8 records (previously 6)."
echo
echo

echo "TABLE participantPosition (w/ enums)"
docker exec -it $DB_ID mysql -uroot -e "
SELECT pp.participantPositionId AS id,
CONCAT(pp.participantCurrencyId, '-', p.name, '-', lat.name) AS participantCurrencyId,
pp.value, pp.reservedValue, pp.changedDate
FROM central_ledger.participantPosition pp
JOIN central_ledger.participantCurrency pc
ON pc.participantCurrencyId = pp.participantCurrencyId
JOIN central_ledger.ledgerAccountType lat
ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
JOIN central_ledger.participant p
ON p.participantId = pc.participantId
ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: dfsp1-SETTLEMENT is unchanged at -80, Hub-HUB_RECONCILIATION account balance is now 80."
echo
echo

echo "TABLE participantPositionChange (w/ enums)"
docker exec -it $DB_ID mysql -uroot -e "
SELECT ppc.participantPositionChangeId AS id,
CONCAT(ppc.participantPositionId, '-', p.name, '-', lat.name) AS participantPositionId,
CONCAT(ppc.transferStateChangeId, '-', tsc.transferStateId, '-', tsc.transferId) transferStateChangeId,
ppc.value, ppc.reservedValue, ppc.createdDate
FROM central_ledger.participantPositionChange ppc
JOIN central_ledger.participantPosition pp
ON pp.participantPositionId = ppc.participantPositionId
JOIN central_ledger.participantCurrency pc
ON pc.participantCurrencyId = pp.participantCurrencyId
JOIN central_ledger.ledgerAccountType lat
ON lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
JOIN central_ledger.participant p
ON p.participantId = pc.participantId
JOIN central_ledger.transferStateChange tsc
ON tsc.transferStateChangeId = ppc.transferStateChangeId
ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: CR is now applied to Hub-HUB_RECONCILIATION during 6-COMMITTED, thus balance is 80 (24:44). Showing 4 records (previously 3)."
echo
echo
