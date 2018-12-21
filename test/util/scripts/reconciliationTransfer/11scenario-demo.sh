#!/usr/bin/env bash
read -p "Make sure you have started central-ledger and press ENTER"
read -p "Press ENTER to run: 11scenario-part0.sh -- Recreate database and init Hub, dfsps and accounts"
sh 11scenario-part0.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part1.sh -- RecordFundsIn PREPARE, RESERVE & COMMIT 100"
sh 11scenario-part1.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part2.sh -- RecordFundsOut PREPARE & RESERVE 20"
sh 11scenario-part2.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part3.sh -- RecordFundsOut COMMIT 20"
sh 11scenario-part3.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part4.sh -- RecordFundsOut PREPARE & RESERVE 200 (auto ABORT)"
sh 11scenario-part4.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part5.sh -- RecordFundsOut PREPARE & RESERVE 50"
sh 11scenario-part5.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-part6.sh -- RecordFundsOut ABORT 50 (manual ABORT)"
sh 11scenario-part6.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-all.sh   -- RUN ALL SCRIPTS and save output to a log file"
sh 11scenario-all.sh > 11scenario-all.log
clear
read -p "Execution completed. Press ENTER to view the log with nano"
nano 11scenario-all.log
