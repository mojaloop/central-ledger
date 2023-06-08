# Stress Testing for Central Ledger using JMeter

## Install

The `AbstractJavaSamplerClient` for Central Ledger needs to be added to the jMeter.

## Configure

### Generate Test Data based of Plan Configuration:
The following command will generate test data based on `CLPlanConfig.json`. Modify the plan configuration
to suit the test scenarios.

```shell
gen_test_data stresstesting/test-plan/CLPlanConfig.json stresstesting/test-plan/InData.json
```

### Print the Test Data:
```shell
print_test_data stresstesting/test-plan/InData.json
```

## Run

In order to successfully run the stress test, the jMeter profile needs to be configured for your 
local environment. Please follow the steps below;
1. Update environment variables in `scripts/start_jMeter.sh`
2. We are now ready to configure jMeter, run the following command;
```shell
scripts/start_jMeter.sh
```

If you wish to execute jMeter in console mode only, execute the following command:
```shell
scripts/start_jMeter.sh console
```
The execution results may be found at `jMeterOut`.


The `` may be executed in order to initiate the stress test. 
