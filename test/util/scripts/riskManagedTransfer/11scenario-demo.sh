#!/usr/bin/env bash
read -p "Make sure you have started central-ledger, ml-api-adapter, mockserver and press ENTER"
read -p "Press ENTER to run: 11scenario-part0.sh -- Recreate database and init Hub, dfsps and accounts"
sh 11scenario-part0.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part1.sh -- Successful transfer prepare"
sh 11scenario-part1.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part2.sh -- Disable dfsp1 and try 2 transfers: as PAYER/PAYEE"
sh 11scenario-part2.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part3.sh -- Disable dfsp1 USD account and try 2 transfers: as PAYER/PAYEE"
sh 11scenario-part3.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-all.sh   -- RUN ALL SCRIPTS and save output to a log file"
sh 11scenario-all.sh > 11scenario-all.log
clear
read -p "Execution completed. Press ENTER to view the log with nano"
nano 11scenario-all.log
