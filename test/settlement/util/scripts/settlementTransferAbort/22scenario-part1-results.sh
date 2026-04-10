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
echo "=> EXPECTED RESULT: Four regular transfers for 100, and 6 settlement transfers. Showing 10 records."
echo
echo

echo "TABLE settlement"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlement ORDER BY createdDate DESC"
echo "=> EXPECTED RESULT: 4 settlements."
echo
echo

echo "TABLE settlementStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlementStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: 4 settlements in different states: PENDING_SETTLEMENT, PS_TRANSFERS_RECORDED, PS_TRANSFERS_RESERVED. 9 records."
echo
echo

echo "TABLE settlementWindowStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlementWindowStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: 4 windows PENDING_SETTLEMENT, 1 window OPEN. 13 records."
echo
echo

echo "TABLE settlementParticipantCurrency"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlementParticipantCurrency ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: 8 records."
echo
echo

echo "TABLE settlementParticipantCurrencyStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.settlementParticipantCurrencyStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: First 2 accounts - PENDING_SETTLEMENT, next 2 - PS_TRANSFERS_RECORDED, next 2 - PS_TRANSFERS_RESERVED,"
echo "last one - PS_TRANSFERS_COMMITTED. Showing 19 records."
echo
echo

echo "TABLE transferStateChange"
docker exec -it $DB_ID mysql -uroot -e "SELECT * FROM central_ledger.transferStateChange ORDER BY 1 DESC"
echo "=> EXPECTED RESULT: 28 records."

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
echo "=> EXPECTED RESULT: 8 records: Hub -400, dfsp1 700, dfsp2 -300."
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
echo "=> EXPECTED RESULT: 14 records."
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
