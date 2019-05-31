# Onboarding

>*Note:* Before completing this guide, make sure you have completed the _general_ onboarding guide in the [base mojaloop repository](https://github.com/mojaloop/mojaloop/blob/master/onboarding.md#mojaloop-onboarding).

## Contents

<!-- vscode-markdown-toc -->
1. [Prerequisites](#Prerequisites)
2. [Installing and Building](#InstallingandBuilding)
3. [Running Locally](#RunningLocally)
4. [Running Inside Docker](#RunningInsideDocker)
5. [Testing](#Testing)
6. [Common Errors/FAQs](#CommonErrorsFAQs)

<!-- vscode-markdown-toc-config
	numbering=true
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

#  1. <a name='Prerequisites'></a>Prerequisites

If you have followed the [general onboarding guide](https://github.com/mojaloop/mojaloop/blob/master/onboarding.md#mojaloop-onboarding), you should already have the following cli tools installed:

* `brew` (macOS), [todo: windows package manager]
* `curl`, `wget`
* `docker` + `docker-compose`
* `node`, `npm` and (optionally) `nvm`

In addition to the above cli tools, you will need to install the following to build and run the `central-ledger`:


###  1.1. <a name='macOS'></a>macOS
```bash
#none - you have everything you need!
```

###  1.2. <a name='Linux'></a>Linux

[todo]

###  1.3. <a name='Windows'></a>Windows

[todo]


##  2. <a name='InstallingandBuilding'></a>Installing and Building

Firstly, clone your fork of the `central-ledger` onto your local machine:
```bash
git clone https://github.com/<your_username>/central-ledger.git
```

Then `cd` into the directory and install the node modules:
```bash
cd central-ledger
npm install
```

> If you run into problems running `npm install`, make sure to check out the [Common Errors/FAQs](#CommonErrorsFAQs) below.

##  3. <a name='RunningLocally'></a>Running Locally (with dependencies inside of docker)

In this method, we will run all of the core dependencies (`kafka`, `mysql` and `mockserver`) inside of docker containers, while running the `central-ledger` server on your local machine.

> Alternatively, you can run the `central-ledger` inside of `docker-compose` with the rest of the dependencies to make the setup a little easier: [Running Inside Docker](#RunningInsideDocker).


**1. Set up the MySQL container, and give it time to initialize**
>*Note:* Before starting all of the containers, start the `mysql` container alone, to give it some more time to set up the necessary permissions (this only needs to be done once, or every time you remove and re-create the container). 

```bash
docker-compose up mysql
```

**2. Run all of the dependencies in `docker-compose`:**

```bash
# start all the dependencies inside of docker
docker-compose up ml-api-adapter mysql kafka mockserver temp_curl

```

**3. Configure the default files and run the server**
```bash
# disable SIDECAR in config/default.json temporary by setting 
# "SIDECAR": { "DISABLED": "true", ...

# set the CLEDG_DATABASE_URI* environment variable:
export CLEDG_DATABASE_URI=mysql://central_ledger:password@localhost:3306/central_ledger

# start the server
npm run start
```

**4. Populate the test database**
```bash
./test/util/scripts/populateTestData.sh
```

Upon running `npm run start`, your output should look similar to:

```bash
> @mojaloop/ml-api-adapter@4.4.1 start /fullpath/to/ml-api-adapter
> run-p start:api


> @mojaloop/ml-api-adapter@4.4.1 start:api /fullpath/to/ml-api-adapter
> node src/api/index.js

http://hostname.local:4000
  GET    /                              Metadata
  GET    /documentation
  GET    /health                        Status of adapter
  GET    /metrics                       Prometheus metrics endpoint
  GET    /swagger.json
  GET    /swaggerui/{path*}
  GET    /swaggerui/extend.js
  POST   /transfers                     Transfer API.
  GET    /transfers/{id}                Get a transfer by Id
  PUT    /transfers/{id}                Fulfil a transfer

2019-02-01T13:30:30.454Z - info: participantEndpointCache::initializeCache::start
2019-02-01T13:30:30.456Z - info: participantEndpointCache::initializeCache::Cache initialized successfully
2019-02-01T13:30:30.457Z - info: Notification::startConsumer
2019-02-01T13:30:30.458Z - info: Notification::startConsumer - starting Consumer for topicNames: [topic-notification-event]
```

##  4. <a name='RunningInsideDocker'></a>Running Inside Docker

We use `docker-compose` to manage and run the `central-ledger` along with its dependencies with one command.

>*Note:* Before starting all of the containers however, start the `mysql` container alone, to give it some more time to set up the necessary permissions (this only needs to be done once). This is a short-term workaround because the `central-ledger` doesn't retry it's connection to MySQL.


**1. First run the mysql container, then run the test of the containers**
```bash
docker-compose up mysql #first time only - the initial mysql load takes a while, and if it's not up in time, the central-ledger will just crash

npm run docker:up
```

This will do the following:
* `docker pull` down any dependencies defined in the `docker-compose.yml` file
* `docker build` the `central-ledger` image based on the `Dockerfile` defined in this repo
* run all of the containers together

**2. Populate the test database - this only needs to be done once**
```bash
./test/util/scripts/populateTestData.sh
```


### 4.1 Handy Docker Compose Tips

You can run `docker-compose` in 'detached' mode as follows:

```bash
npm run docker:up -- -d
```

And then attach to the logs with:
```bash
docker-compose logs -f
```

When you're done, don't forget to stop your containers however:
```bash
npm run docker:stop
```

### 4.2 (Optional) Connecting MySQLWorkbench to MySQL inside Docker

If you installed MySQLWorkbench from the [general onboarding guide](https://github.com/mojaloop/mojaloop/blob/master/onboarding.md#5-mysqlworkbench-optional), follow these instructions to get MySQLWorkbench connected to the `mysql` container running in docker.

Please follow the below instructions:

1. Click the add (+) icon 

<img src="images/MySQL_Help_a.png" width="400">

2. Enter the following details:
    * **Connection Name:** `central_ledger@localhost`
    * **Username:** `central_ledger`

   And Click "Test Connection"

<img src="images/MySQL_Help_2.png" width="600">

3. Enter the Password: 'password' > click "OK"

<img src="images/MySQL_Help_3.png" width="400">

4. If successful, you will see the following dialogue:
    * click "OK" to dismiss the dialogue
    * click "OK" once more to confirm the database connection

<img src="images/MySQL_Help_4.png" width="400">

5. This should now be shown on you MySQLWorkbench dashboard
    * click on the connection to open the database

<img src="images/MySQL_Help_5.png" width="400">

6. In the top left, click the **schema** tab > and expand **central_ledger** section
    * You should see the `central_ledger` database underneath
    * if you haven't yet started your server, no tables will be present, but they will be populated when you start your server

<img src="images/MySQL_Help_6.png" width="400">


##  5. <a name='Testing'></a>Testing

We use `npm` scripts as a common entrypoint for running the tests.
```bash
# unit tests:
npm run test:unit

# integration tests
npm run test:integration

# check test coverage
npm run test:coverage
```

### 5.1 Testing the `central-ledger` API with Postman

>Note: Make sure you have installed Postman and cloned the `mojaloop/postman` repo, which contains all the required collections and environments. You can find detailed instructions for this in the [general onboarding guide](https://github.com/mojaloop/mojaloop/blob/master/onboarding.md#2-postman).


#### Prerequisites:
* `ml-api-adapter` and `central-ledger` services running (follow [Running Locally](#RunningLocally) or [Running Inside Docker](#RunningInsideDocker) to get these services up and running)
* _Optionally_, run `central-timeout` , `cental-settlement` as well.


#### Running Example Requests
1. Import the **Mojaloop v0.1 draft** collection, and open `API Examples` > `mojaloop v1.0` > `6.a. Transfer Prepare Request`
2. Click **Send**
3. If you get a valid response, continue to the next step, otherwise it reveals an issue in your configuration. 
4. Select the `7.a. Transfer Fulfil Request` and perform a corresponding fulfilment request
5. You can check the database to see the transfer state, status changes, positions and other such information. After this if everything looks good, you should be ready to go.


##  6. <a name='CommonErrorsFAQs'></a>Common Errors/FAQs

#### 6.1 `sodium v1.2.3` can't compile during npm install

Resolved by installing v2.0.3 `npm install sodium@2.0.3`


#### 6.2 `./src/argon2_node.cpp:6:10: fatal error: 'tuple' file not found` 

Resolved by running `CXX='clang++ -std=c++11 -stdlib=libc++' npm rebuild`


#### 6.3 On macOS, `npm install` fails with the following error
```
Undefined symbols for architecture x86_64:
  "_CRYPTO_cleanup_all_ex_data", referenced from:
      _rd_kafka_transport_ssl_term in rdkafka_transport.o
  "_CRYPTO_num_locks", referenced from:
  ........
  ld: symbol(s) not found for architecture x86_64
clang: error: linker command failed with exit code 1 (use -v to see invocation) 
```

Resolved by installing openssl `brew install openssl` and then running: 
  ```bash
  export CFLAGS=-I/usr/local/opt/openssl/include 
  export LDFLAGS=-L/usr/local/opt/openssl/lib 
  npm install
  ```  