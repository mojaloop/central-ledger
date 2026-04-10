#!/usr/bin/env bash
read -p "Make sure you have started ml-api-adapter, central-ledger, central-settlement and press ENTER"
read -p "Press ENTER to run: 12scenario-part0.sh -- Recreate database and init Hub, dfsps and accounts"
sh 12scenario-part0.sh | less -MQ~+Gg
read -p "Press ENTER to run: 12scenario-part1.sh -- Four settlements setup"
sh 12scenario-part1.sh | less -MQ~+Gg
read -p "Press ENTER to run: 12scenario-part2.sh -- ABORT settlements"
sh 12scenario-part2.sh | less -MQ~+Gg
read -p "Press ENTER to run: 11scenario-all.sh   -- RUN ALL SCRIPTS and save output to log file"
sh 12scenario-all.sh > 12scenario-all.log
clear
read -p "Execution completed. Press ENTER to view the log with nano"
nano 12scenario-all.log