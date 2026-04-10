#!/usr/bin/env bash
read -p "Make sure you have started ml-api-adapter, central-ledger, central-settlement and press ENTER"
read -p "Press ENTER to run: 11scenario-part0.sh -- Recreate database and init Hub, dfsps and accounts"
sh 11scenario-part0.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part1.sh -- Prepare and fulfil 2 transfers, close window, create settlement, PS_TRANSFERS_RECORDED for PAYER"
sh 11scenario-part1.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part2.sh -- PS_TRANSFERS_RECORDED for PAYEE"
sh 11scenario-part2.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part3.sh -- PS_TRANSFERS_RESERVED for PAYER & PAYEE"
sh 11scenario-part3.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part4.sh -- PS_TRANSFERS_COMMITTED for PAYER & PAYEE"
sh 11scenario-part4.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part5.sh -- SETTLED for PAYER, SETTLED for PAYER - additional note"
sh 11scenario-part5.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part6.sh -- SETTLED for PAYEE"
sh 11scenario-part6.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-all.sh   -- RUN ALL SCRIPTS and save output to log file"
sh 11scenario-all.sh > 11scenario-all.log
clear
read -p "Execution completed. Press ENTER to view the log with nano"
nano 11scenario-all.log