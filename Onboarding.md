# Central Ledger Setup

***

### Introduction 
In this document we'll walk through the setup for the Mojaloop Central Ledger. It consists of three sections:

* [Software List](#software-list)
* [Setup](#setup)
* [Errors On Setup](#errors-on-setup)

***

### Software List
1. Github
2. brew
3. Docker
4. MySQLWorkbench
5. Postman
6. nvm
7. npm
8. Zenhub
9. central_ledger
10. JavaScript IDE
***

### Setup
Make sure you have access to [Mojaloop on Github](https://github.com/mojaloop/central-ledger) and clone the project.

#### Installing brew
##### macOS
```
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

##### Ubuntu
To install Linuxbrew, follow these [instructions](http://linuxbrew.sh/#install-linuxbrew)

#### Installing Docker
To install Docker, follow these instructions: [Docker for Mac](https://docs.docker.com/docker-for-mac/), [Docker for Ubuntu](https://docs.docker.com/install/linux/docker-ce/ubuntu/#install-using-the-repository)

#### Installing MySQL

##### Docker
Run the following commands in your terminal. Please ensure that you run the MySQL statements with the semicolon at the end.
```
DBUSER=central_ledger; DBPASS=password; SLEEPTIME=15; docker stop mysql; docker rm mysql; docker run -p 3306:3306 -d --name mysql -e MYSQL_USER=$DBUSER -e MYSQL_PASSWORD=$DBPASS -e MYSQL_DATABASE=$DBUSER -e MYSQL_ALLOW_EMPTY_PASSWORD=true mysql/mysql-server; sleep $SLEEPTIME; docker exec -it mysql mysql -uroot -e "ALTER USER '$DBUSER'@'%' IDENTIFIED WITH mysql_native_password BY '$DBPASS';"
```

#### Installing MySQLWorkBench
##### macOS
```
Go to and follow the instructions
https://dev.mysql.com/downloads/workbench/
```
##### Ubuntu
For pgAdmin 4 v2.1 on Ubuntu, according to the [download page](https://www.pgadmin.org/download/pgadmin-4-python-wheel):

Install dependencies, create a virtual environment, download, install & configure:
```
sudo apt-get install virtualenv python-pip libpq-dev python-dev

cd
virtualenv pgadmin4
cd pgadmin4
source bin/activate

pip install https://ftp.postgresql.org/pub/pgadmin/pgadmin4/v2.1/pip/pgadmin4-2.1-py2.py3-none-any.whl
```
Override default paths and set it to single-user mode in the [local configuration file](https://www.pgadmin.org/docs/pgadmin4/dev/server_deployment.html):
```
nano lib/python2.7/site-packages/pgadmin4/config_local.py
```
*Write:*
```
import os
DATA_DIR = os.path.realpath(os.path.expanduser(u'~/.pgadmin/'))
LOG_FILE = os.path.join(DATA_DIR, 'pgadmin4.log')
SQLITE_PATH = os.path.join(DATA_DIR, 'pgadmin4.db')
SESSION_DB_PATH = os.path.join(DATA_DIR, 'sessions')
STORAGE_DIR = os.path.join(DATA_DIR, 'storage')
SERVER_MODE = False
```
Make a shortcut:
```
touch ~/pgadmin4/start
chmod +x ~/pgadmin4/start
nano ~/pgadmin4/start
```
*Write:*
```
#!/bin/bash
cd ~/pgadmin4
source bin/activate
python lib/python2.7/site-packages/pgadmin4/pgAdmin4.py
```
Run with `~/pgadmin4/start`
 and access at [http://localhost:5050](http://localhost:5050)

##### Setup MySQLWorkbench
Please follow the below instructions:

a. Click the add (+) icon 

 ![](images/MySQL_Help_a.png)

b. Enter the Connection name and username as per image and click test connection

 ![](images/MySQL_Help_2.png)

c. Enter the password => 'password' click OK

 ![](images/MySQL_Help_3.png)

d. You should see this click OK

 ![](images/MySQL_Help_4.png)

e. This should now be shown on you MySQLWorkbench dashboard

 ![](images/MySQL_Help_5.png)

f. You should see the central_ledger database under schema no tables will be present but will get populated when you start your server

![](images/MySQL_Help_6.png)

#### Installing Postman
Please, follow these instructions: [Get Postman](https://www.getpostman.com/postman)

Alternatively on **Ubuntu** you may run:
```
wget https://dl.pstmn.io/download/latest/linux64 -O postman.tar.gz
sudo tar -xzf postman.tar.gz -C /opt
rm postman.tar.gz
sudo ln -s /opt/Postman/Postman /usr/bin/postman
```

##### Setup Postman
* open *Postman*
* click **Import** and then **Import File**
* navigate to the central_ledger directory and select (to be added) and import it into postman
#### nvm 

######(This is optional, you can install node directly from the website, node version manager(nvm) isn't really needed unless you want to use multiple versions of node)

If you don't have cURL already installed, on **Ubuntu** run `sudo apt install curl`

Download the nvm install via Homebrew:

```
brew update
brew install nvm
mkdir ~/.nvm
vi ~/.bash_profile
```

* Ensure that nvm was installed correctly with `nvm --version`, which should return the version of nvm installed
* Install the version (at time of publish 8.9.4 current LTS) of Node.js you want:
  * Install the latest LTS version with `nvm install --lts`
  * Use the latest LTS verison with `nvm use --lts`
  * Install the latest version with `nvm install node`
  * Use the latest version with `nvm use node`
  * If necessary, fallback to `nvm install 8.9.4`

##### Setup nvm
Create a *.bash_profile* file with `touch ~/.bash_profile`, then `nano ~/.bash_profile` and *write*:
```
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" # This loads nvm
```

#### npm
By installing *node* during *nvm* installation above, you should have the corresponding npm version installed

##### Setup npm
* The _.npmrc_ file in your user root just needs to be present as the repository it will use is 
http://npmjs.org If it doesn't exist just create it.

#### Installing ZenHub for GitHub
Open Google Chrome browser and navigate to [Zenhub Extension](https://chrome.google.com/webstore/detail/zenhub-for-github/ogcgkffhplmphkaahpmffcafajaocjbd)

#### Installing central_ledger
* **cd** into the central_ledger project and run subsequently the following commands:
```
npm install -g node-gyp (needs to be done once)
brew install libtool autoconf automake (needs to be done once)
npm install
source ~/.bash_profile
npm rebuild
```
* set *CLEDG_DATABASE_URI* environment variable:
```
export CLEDG_DATABASE_URI=mysql://central_ledger:password@localhost:3306/central_ledger
```
* disable SIDECAR in **config/default.json** temporary by setting `"SIDECAR": { "DISABLED": "true", ...`
* run `npm start` *(to run it locally)* or `npm run dev` *(to run it on your Docker host)*

##### Run Postman
* Use the postman collection from the [postman repo](https://github.com/mojaloop/postman)
* To use this collection, the ml-api-adapter service needs to be running along with the central-ledger service (preferably central-timeout , cental-settlement as well, but they are optional)
* click on **mojaloop v1.0** and then **6.a. Transfer Prepare Request**
* click **Send**
* if you get a valid response, it is a good first step.
* You can also then select the **7.a. Transfer Fulfil Request** and perform a corresponding fulfilment request
* You can check the database to see the transfer state, status changes, positions and other such information. After this if everything looks good, you should be ready to go.

### Errors On Setup
* `./src/argon2_node.cpp:6:10: fatal error: 'tuple' file not found` 
  - resolved by running `CXX='clang++ -std=c++11 -stdlib=libc++' npm rebuild`
* sodium v1.2.3 can't compile during npm install
  - resolved by installing v2.0.3 `npm install sodium@2.0.3`
