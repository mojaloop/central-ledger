# Running central-ledger on Kubernetes

1. Install VirtualBox
    Refer to: https://www.virtualbox.org/wiki/Downloads

2. Install Docker
    MacOS: `brew install docker`

3. Install Kubectl
    MacOS: `brew install kubectl`

4. Install Minikube
    MacOS: `brew cask install minikube`

5. Install Helm
    MacOS: `brew install kubernetes-helm`

6. Initialise MiniKube
    `minikube start`

7. Initialise Helm
    `helm init` <-- this only needs to be done once

8. Deploy Ingress
    `minikube addon enable ingress`

9. Configure PostgreSQL
    Edit `postgresUser` & `postgresPassword` as desired in the following file `./deploy/helm/central-ledger-helm-postgresql-values.yaml` 

10. Deploy PosgreSQL
    `helm install --name central-ledger -f ./deploy/helm/central-ledger-helm-postgresql-values.yaml stable/postgresql`

11. Configure credentials in the Central-ledger-secret
    Edit `db.uri` with the details from step 10 above in the following file `./deploy/k8s/central-ledger-secret.yaml`. 
    
    Ensure the values are base64 encoded.

12. Deploy Central-ledger
    `kubectl create -f ./deploy/k8s`

    Or alternatively you can stipulate a namespace for deployment
    `kubectl -n dev create -f ./deploy/k8s`

13. Add the following to your hosts file
`<IP>	central-ledger.local`

Where `<IP>` can be attained using the following command `minikube ip`

14. Open K8s Dashboard

`minikube dashboard`
