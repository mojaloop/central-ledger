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

echo "TABLE transfer"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transfer ORDER BY createdDate DESC"
echo "=> EXPECTED RESULT: Two regular transfers for 600 and 200, and one settlement transfer for the amount of 800."
echo
echo

echo "TABLE settlement"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlement ORDER BY createdDate DESC"
echo "=> EXPECTED RESULT: Settlement 1 is created."
echo
echo

echo "TABLE settlementStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlementStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Settlement state for settlementId 1 is PENDING_SETTLEMENT."
echo
echo

echo "TABLE settlementWindowStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlementWindowStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Settlement window 1 is CLOSED, window 2 is OPEN, and later window 1 is PENDING_SETTLEMENT."
echo
echo

echo "TABLE settlementParticipantCurrency"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlementParticipantCurrency ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Two settlement accounts are created, settlement transfer is created for the first one."
echo
echo

echo "TABLE settlementParticipantCurrencyStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlementParticipantCurrencyStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Both accounts are initially PENDING_SETTLEMENT, but later the first one is changed to PS_TRANSFERS_RECORDED."
echo
echo

echo "TABLE transferDuplicateCheck"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transferDuplicateCheck ORDER BY createdDate DESC"
echo "=> EXPECTED RESULT: As one of the settlement accounts is PS_TRANSFERS_RECORDED, a transfer is prepared. Showing 3 records."
echo
echo

echo "TABLE transferFulfilment"
docker exec -it $DB_ID mysql -uroot -e "
SELECT SUBSTRING(transferId, -20) AS trasnferId_20,
SUBSTRING(transferFulfilmentId, -20) AS transferFulfilmentId_20,
ilpFulfilment, completedDate, isValid, settlementWindowId, createdDate
FROM central_ledger.transferFulfilment 
ORDER BY createdDate DESC"
echo "=> EXPECTED RESULT: Only the regular transfers are fulfiled. Showing 2 records."
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
echo "=> EXPECTED RESULT: Transfer participants are inserted for the prepared settlement transfer. Showing 6 records."
echo "The settlement transfer is for the SETTLEMENT_NET_SENDER, thus: DR POSITION -800 / CR HUB_MULTILATERAL_SETTLEMENT 800."
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

echo "TABLE transferStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transferStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: Both regular transfers are COMMITTED. The last record for the settlement transfer is RECEIVED_PREPARE."

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
echo "=> EXPECTED RESULT: Position is not affected by settlement being PS_TRANSFERS_RECORDED."
echo "Thus position accounts for both dfsps are showing ±800."
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
echo "=> EXPECTED RESULT: Same as previous result, but showing history bottom-up. Showing 4 records."
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
echo "=> EXPECTED RESULT: Participant limits are not affected. Showing 3 records."
echo
echo
