# Performance and Scalability testing
Percona XtraDB high availability cluster with MySQL database.
***

## Contents

* [**Getting Started**](#getting-started)
* [**Base line before embarking on this test**](#base-line-before-embarking-on-this-test)
* [**Running the tests**](#running-the-tests)
* [**Categories of testing done as during this phase**](#categories-of-testing-done-as-during-this-phase)


## Getting Started
Please read and follow instructions in the [README.md](https://github.com/mojaloop/central-ledger/blob/develop-baseline/README.md) for setting up a local environment.
Download and install JMeter.

Control tests were executed on the Amazon Web Services Cluster specifically setup to establish a baseline.

Additional setup required.
[KUBERNETES.md](https://github.com/mojaloop/central-ledger/blob/develop-baseline/KUBERNETES.md).

## Base line before embarking on this test
The base line performance for the 'Prepare functionality' was previously established at 202 transactions per second.

## Running the tests
[TransferGuide](https://github.com/mojaloop/central-ledger/blob/develop-baseline/TransferGuide.md).
- First action required to create the DSFP's for the transfers.
- Second action is required for the prepare statement, as used for the testing results below. Test scripts to be use during this process is available on this project(https://github.com/mojaloop/test-scripts).

## Categories of testing done as during this phase
#### Performance testing
Base performance was established to understand the baseline using 3 Percona clusters setup in the Master/Master/Master configuration, using one central-ledger service.
A baseline was established for 200 DFSP users achieving an average throughput of 211.5 transactions per second.

#### Scalability testing
The following figures for the below benchmark to indicate the scalability of the Percona cluster, using 200 concurrent DFSP users and increase the number of central-directory services.
1.  central-service pod with 200 concurrent DFSP users achieved an average throughput of 211.50 transactions per second.
2. central-service pod's with 200 concurrent DFSP users achieved an average throughput of 456.80 transactions per second.
3. central-service pod's with 200 concurrent DFSP users achieved an average throughput of 464.03 transactions per second.
4. central-service pod's with 200 concurrent DFSP users achieved an average throughput of 725.30 transactions per second.
5. central-service pod's with 200 concurrent DFSP users achieved an average throughput of 732.00 transactions per second.

We notice a linear increase between the increase in central-ledger service pod's on Kubernetes and the throughput. On the last test we noticed a graph is starting to "flattened". This is most likely due to system resources limitations.

#### Failover testing
To provide conclusive prove of the Percona XtraDB cluster ability to recover seamlessly from a disaster on a pod, the following actions were taken:
- ensure service is running and stable.
- on Kubernetes, "delete" one of the database pod's.
- monitor the system to insure the pod is "killed".
- after confirming the pod is unavailable, monitor automated recovery.
- once automated recovery of the effects pod is completed, and the JMeter process is completed, a dump is made of all 3 database clusters individually, as well as the accessible database point via the ingress load balancer.
- a report is obtained from the JMeter process containing all the prepare statements made during this test.
- the 3 DB clusters data is compared to insure data integrity and seamless recovery and restoration of the effected pod.
- the Jmeter report is also compared with the database dumps to insure no data was lost during the process and thereby proving high availability and insuring integrity of the system.

## Conclusion
With the above actions during the testing and verification process on the transactional database, we were able to prove the database to be highly available (HA) and highly scalable (HS) in order for the solution to be robust and scale based on demand
