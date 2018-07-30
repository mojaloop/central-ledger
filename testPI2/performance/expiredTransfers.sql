SELECT COUNT(*) FROM central_ledger.transferStateChange;
SELECT COUNT(*) FROM central_ledger.transfer;
 
SELECT t.*, tsc.transferStateId
FROM central_ledger.transfer t
JOIN (SELECT transferId, MAX(transferStateChangeId) transferStateChangeIdMax
	  FROM central_ledger.transferStateChange
	  GROUP BY transferId) ts
ON ts.transferId = t.transferId
JOIN central_ledger.transferStateChange tsc
ON tsc.transferStateChangeId = ts.transferStateChangeIdMax
WHERE tsc.transferStateId IN ('RECEIVED_PREPARE', 'RESERVED')
AND t.expirationDate < now() + interval 3 hour
ORDER BY expirationDate DESC
LIMIT 10000;
