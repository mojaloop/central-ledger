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
2. Slack (Optional)
3. brew
4. Docker
5. PostgreSQL 9.4
6. pgAdmin4
7. Visual Studio Code
8. Postman
9. nvm
10. npm
11. Zenhub
12. central_ledger
***

### Setup
Make sure you have access to [Mojaloop on Github](https://github.com/mojaloop/central-ledger) and clone the project.

To install Homebrew run this in a terminal window:
```
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

To install Docker, follow these instructions: [Docker for Mac](https://docs.docker.com/docker-for-mac/)

To install Visual Studio Code, follow these instructions: [Visual Studio Code](http://code.visualstudio.com)

To install Postman, follow these instructions: [Get Postman](https://www.getpostman.com/docs/introduction)

##### Setup Docker
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
* to install *pgAdmin4*, run `brew cask install pgAdmin4`

##### Setup pgAdmin4
* create a central_ledger user by right clicking on **Login/Group Roles** and then **Create**
* right click on the central_ledger user and select **Properties**
* make sure the username and password match the username and password in the .env file
* click on privileges and set **Can login?** to **Yes**

##### Setup nvm & npm
* run `curl -udwolla:AP6vR3LGrB6zm8WQjLvJHnQzjJp "https://modusbox.jfrog.io/modusbox/api/npm/level1-npm/auth/@mojaloop" >> ~/.npmrc`
* run `cp ~/.npmrc .npmrc` which will allow you to run the functional tests on your machine
* to install nvm run `curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.1/install.sh | bash`
* create a *.bash_profile* file with `touch ~/.bash_profile` and verify your *.bash_profile* looks like this:
```
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" # This loads nvm
export CLEDG_DATABASE_URI=postgres://central_ledger:cVq8iFqaLuHy8jjKuA@localhost:5432/central_ledger
```

* cd into the central_ledger project
* run `nvm install 6.5.0`
* run `nvm use`
* run `npm install -g node-gyp`
* run `brew install libtool autoconf automake`
* run `npm install`
* run `source ~/.bash_profile`
* run `npm rebuild`
* run `npm start` *(to run it locally)* or `npm run dev` *(to run it on your Docker host)*

##### Setup Postman
* open *Postman*
* click **Import** and then **Import File**
* navigate to the central_ledger directory and select [postman.json](./postman.json)
* click on **Central Ledger** and then **Prepare transfer**
* click **Send**
* if you get a valid response, you should be ready to go

### Errors On Setup
* `./src/argon2_node.cpp:6:10: fatal error: 'tuple' file not found` 
  - resolved by running `CXX='clang++ -std=c++11 -stdlib=libc++' npm rebuild`
