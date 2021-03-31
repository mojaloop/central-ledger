
// Tape 4.X doesn't handle uncaught exceptions very well
// we manually watch for them and fail the tests
process.on('uncaughtException', (err) => {
  console.log('\x1b[31m%s\x1b[0m', '✘ Fatality! Uncaught Exception within unit tests, error thrown:');
  console.log(err);
  console.log('not ok 1');
  console.log('\x1b[31m%s\x1b[0m', 'Force-Exiting process ...');
  process.exit(1);
});