#!/usr/bin/env bash
# Setup the following variables for your local environment:
export JMETER_HOME="/home/jbruwer/Applications/apache-jmeter-5.3"
export HEAP="-Xms3g -Xmx6g -XX:MaxMetaspaceSize=2024m"
# Optional:
# export JAVA_HOME=""

# First build to get the latest:
mvn clean
mvn clean install -U
mvn clean install assembly:single

# Copy the jar over:
cp target/central-ledger-jmeter-jar-with-dependencies.jar $JMETER_HOME/lib

# Clear logs:
rm jmeter.log
rm jMeterResults.log

# Default to GUI mode
if [ "$1" == "console" ]; then
    $JMETER_HOME/bin/jmeter -n -t test-plan/JMeter-CentralLedgerPlan-Default.jmx -l jMeterResults.log -e -o jMeterOut
else
    $JMETER_HOME/bin/jmeter -t test-plan/JMeter-CentralLedgerPlan-Default.jmx
fi

