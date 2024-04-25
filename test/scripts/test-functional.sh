#!/bin/bash

echo "--=== Running Functional Test Runner ===--"
echo

CENTRAL_LEDGER_VERSION=${CENTRAL_LEDGER_VERSION:-"local"}
ML_CORE_TEST_HARNESS_VERSION=${ML_CORE_TEST_HARNESS_VERSION:-"v1.2.4-fx-snapshot.5"}
ML_CORE_TEST_HARNESS_GIT=${ML_CORE_TEST_HARNESS_GIT:-"https://github.com/mojaloop/ml-core-test-harness.git"}
ML_CORE_TEST_HARNESS_TEST_PROV_CONT_NAME=${ML_CORE_TEST_HARNESS_TEST_PROV_CONT_NAME:-"ttk-func-ttk-provisioning-fx-1"}
ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME=${ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME:-"ttk-func-ttk-fx-tests-1"}
ML_CORE_TEST_HARNESS_DIR=${ML_CORE_TEST_HARNESS_DIR:-"/tmp/ml-api-adapter-core-test-harness"}
ML_CORE_TEST_SKIP_SHUTDOWN=${ML_CORE_TEST_SKIP_SHUTDOWN:-false}

echo "==> Variables:"
echo "====> ML_API_ADAPTER_VERSION=$ML_API_ADAPTER_VERSION"
echo "====> ML_CORE_TEST_HARNESS_VERSION=$ML_CORE_TEST_HARNESS_VERSION"
echo "====> ML_CORE_TEST_HARNESS_GIT=$ML_CORE_TEST_HARNESS_GIT"
echo "====> ML_CORE_TEST_HARNESS_TEST_PROV_CONT_NAME=$ML_CORE_TEST_HARNESS_TEST_PROV_CONT_NAME"
echo "====> ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME=$ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME"
echo "====> ML_CORE_TEST_HARNESS_DIR=$ML_CORE_TEST_HARNESS_DIR"
echo "====> ML_CORE_TEST_SKIP_SHUTDOWN=$ML_CORE_TEST_SKIP_SHUTDOWN"

echo "==> Cloning $ML_CORE_TEST_HARNESS_GIT:$ML_CORE_TEST_HARNESS_VERSION into dir=$ML_CORE_TEST_HARNESS_DIR"
git clone --depth 1 --branch $ML_CORE_TEST_HARNESS_VERSION $ML_CORE_TEST_HARNESS_GIT $ML_CORE_TEST_HARNESS_DIR

echo "==> Copying configs from ./docker/config-modifier/*.* to $ML_CORE_TEST_HARNESS_DIR/docker/config-modifier/configs/"
cp -f ./docker/config-modifier/*.* $ML_CORE_TEST_HARNESS_DIR/docker/config-modifier/configs/

## Set initial exit code value to 1 (i.e. assume error!)
TTK_FUNC_TEST_EXIT_CODE=1

## Change to the test harness directory
pushd $ML_CORE_TEST_HARNESS_DIR

  ## Make reports directory
  mkdir ./reports

  ## Start the test harness
  echo "==> Starting Docker compose"
  docker compose --project-name ttk-func --ansi never --profile all-services --profile fx --profile ttk-provisioning-fx --profile ttk-fx-tests up -d

  echo "==> Running wait-for-container.sh $ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME"
  ## Wait for the test harness to complete, and capture the exit code
  bash wait-for-container.sh $ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME
  ## Capture exit code for test harness
  TTK_FUNC_TEST_EXIT_CODE="$?"
  echo "==> wait-for-container.sh exited with code: $TTK_FUNC_TEST_EXIT_CODE"

  ## Copy the test results
  docker logs $ML_CORE_TEST_HARNESS_TEST_PROV_CONT_NAME > ./reports/ttk-provisioning-console.log
  docker logs $ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME > ./reports/ttk-tests-console.log

  ## Grab the exit code
  ## NOTE: This is not working as expected, so we're using the exit code from the wait-for-container.sh script
  # export TTK_FUNC_TEST_EXIT_CODE=$(docker inspect $ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME --format='{{.State.ExitCode}}')

  ## Shutdown the test harness
  if [ $ML_CORE_TEST_SKIP_SHUTDOWN == true ]; then
    echo "==> Skipping test harness shutdown"
  else
    echo "==> Shutting down test harness"
    docker compose --project-name ttk-func --ansi never --profile all-services --profile fx --profile ttk-provisioning-fx --profile ttk-fx-tests down -v
  fi

  ## Dump log to console
  cat ./reports/ttk-tests-console.log

## Reset directory
popd

## Exit with the exit code from the test harness
echo "==> Exiting functional tests with code: $TTK_FUNC_TEST_EXIT_CODE"
exit $TTK_FUNC_TEST_EXIT_CODE
