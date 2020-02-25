
Add Helm repository:

```bash
helm repo add incubator http://storage.googleapis.com/kubernetes-charts-incubator

```

Install Kafka:

```bash
helm install --namespace testcss --name cssk incubator/kafka -f ./values.yml
```
