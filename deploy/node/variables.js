const environment = process.env.ENVIRONMENT || 'TEST'

module.exports = {
  AWS_ACCOUNT_ID: process.env.AWS_ACCOUNT_ID || 886403637725,
  APP_NAME: process.env.APP_NAME || 'central-ledger',
  AWS_REGION: process.env.AWS_REGION || 'us-west-2',
  ENVIRONMENT: environment,
  VERSION: process.env.CIRCLE_TAG || process.env.CIRCLE_BRANCH + '-' + process.env.CIRCLE_BUILD_NUM,
  API: {
    NAME: 'central-ledger',
    IMAGE: process.env.API_IMAGE || 'leveloneproject/central-ledger',
    PORT: process.env.API_PORT || 3000
  },
  ADMIN: {
    NAME: 'central-ledger-admin',
    IMAGE: process.env.ADMIN_IMAGE || 'leveloneproject/central-ledger-admin',
    PORT: process.env.ADMIN_PORT || 3001
  },
  CLUSTER: process.env.CLUSTER || 'central-services-' + environment,
  DOCKER_EMAIL: process.env.DOCKER_EMAIL,
  DOCKER_USER: process.env.DOCKER_USER,
  DOCKER_PASS: process.env.DOCKER_PASS,
  HOSTNAME: process.env.HOSTNAME || 'http://central-ledger-TEST-1778278640.us-west-2.elb.amazonaws.com',
  JFROG_REPO: process.env.JFROG_REPO || 'modusbox-level1-docker-release.jfrog.io',
  POSTGRES_USER: process.env.DEV_POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.DEV_POSTGRES_PASSWORD,
  POSTGRES_HOST: process.env.DEV_POSTGRES_HOST,
  SIDECAR: {
    NAME: 'forensic-logging-sidecar',
    IMAGE: process.env.SIDE_IMAGE || 'leveloneproject/forensic-logging-sidecar',
    PORT: process.env.SIDE_PORT || 5678,
    POSTGRES_USER: process.env.SIDE_POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.SIDE_POSTGRES_PASSWORD,
    POSTGRES_HOST: process.env.SIDE_POSTGRES_HOST,
    KMS_URL: process.env.SIDE_KMS_URL || 'ws://central-kms-test-825003705.us-west-2.elb.amazonaws.com/sidecar'
  }
}
