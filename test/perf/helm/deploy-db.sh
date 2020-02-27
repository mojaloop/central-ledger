## Helm installation of DB
helm install --namespace testcss --name css-db stable/percona-xtradb-cluster -f ./valuesDb.yml

## Add annotations for monitoring
kubectl -n testcss annotate pods css-db-centralledger-mysql-0 prometheus.io/port=9104
kubectl -n testcss annotate pods css-db-centralledger-mysql-0 prometheus.io/scrape=true
