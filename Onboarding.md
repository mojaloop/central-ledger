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
4. PostgreSQL 9.4
5. pgAdmin4
6. Postman
7. nvm
8. npm
9. Zenhub
10. central_ledger
11. JavaScript IDE
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

#### Installing PostgreSQL 9.4
##### Ubuntu
```
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
```
##### Docker
* create a *docker-compose.yml* file that looks like this:
```
version: '2'
services:
  postgres:
    ports:
     - "5432:5432"
    image: postgres:9.4
    environment:
     - POSTGRES_PASSWORD=postgres
     - POSTGRES_USER=postgres
```
* run `docker-compose up -d` from the folder where *docker-compose.yml* is located.
* PostgreSQL 9.4 should now be installed
* run `docker ps` to verify Docker is running

#### Installing pgAdmin4
##### macOS
```
brew cask install pgAdmin4
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

##### Setup pgAdmin4
* create a **central_ledger** user by right clicking on **Login/Group Roles** and then **Create**
  * right click on the central_ledger user and select **Properties**
  * make sure the username and password match the username and password in the .env file
  * click on privileges and set **Can login?** to **Yes**
* create a **central_ledger** database by right clicking on **Databases** and then **Create > Database...**

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
* navigate to the central_ledger directory and select [postman.json](./postman.json)

#### nvm
If you don't have cURL already installed, on **Ubuntu** run `sudo apt install curl`

Download the nvm install script via cURL:
```
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.0/install.sh | bash
```
* Ensure that nvm was installed correctly with `nvm --version`, which should return the version of nvm installed
* Install the version of Node.js you want:
  * Install the latest LTS version with `nvm install --lts`
  * Use the latest LTS verison with `nvm use --lts`
  * Install the latest version with `nvm install node`
  * Use the latest version with `nvm use node`
  * If necessary, fallback to `nvm install 6.5.0` and `nvm use 6`

##### Setup nvm
Create a *.bash_profile* file with `touch ~/.bash_profile`, then `nano ~/.bash_profile` and *write*:
```
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" # This loads nvm
```

#### npm
By installing *node* during *nvm* installation above, you should have the correspoding npm version installed

##### Setup npm
* run `curl -udwolla:AP6vR3LGrB6zm8WQjLvJHnQzjJp "https://modusbox.jfrog.io/modusbox/api/npm/level1-npm/auth/@mojaloop" >> ~/.npmrc`
* run `cp ~/.npmrc .npmrc` which will allow you to run the functional tests on your machine

#### Installing ZenHub for GitHub
Open Google Chrome browser and navigate to [Zenhub Extension](https://chrome.google.com/webstore/detail/zenhub-for-github/ogcgkffhplmphkaahpmffcafajaocjbd)

#### Installing central_ledger
* **cd** into the central_ledger project and run subsequently the following commands:
```
npm install -g node-gyp
brew install libtool autoconf automake
npm install
source ~/.bash_profile
npm rebuild
```
* set *CLEDG_DATABASE_URI* environment variable:
```
export CLEDG_DATABASE_URI=postgres://central_ledger:cVq8iFqaLuHy8jjKuA@localhost:5432/central_ledger
```
* disable SIDECAR in **config/default.json** temporary by setting `"SIDECAR": { "DISABLED": "true", ...`
* run `npm start` *(to run it locally)* or `npm run dev` *(to run it on your Docker host)*

##### Run Postman
* click on **Central Ledger** and then **Prepare transfer**
* click **Send**
* if you get a valid response, you should be ready to go

### Errors On Setup
* `./src/argon2_node.cpp:6:10: fatal error: 'tuple' file not found` 
  - resolved by running `CXX='clang++ -std=c++11 -stdlib=libc++' npm rebuild`
* sodium v1.2.3 can't compile during npm install
  - resolved by installing v2.0.3 `npm install sodium@2.0.3`