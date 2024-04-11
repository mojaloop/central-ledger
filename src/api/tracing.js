const opentelemetry = require('@opentelemetry/sdk-node')
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { HapiInstrumentation } = require('@opentelemetry/instrumentation-hapi')
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger')
// const Config = require('./lib/config')

const url = 'ht' + 'tp' + '://'

const options = {
  tags: [], // optional
  endpoint: `${url}tempo-grafana-tempo-distributor.monitoring.svc.cluster.local:14268/api/traces`
  // endpoint: Config.INSTRUMENTATION_METRICS_TEMPO_URL || 'http://localhost:14268/api/traces'
}
const exporter = new JaegerExporter(options)

const sdk = new opentelemetry.NodeSDK({
  serviceName: 'central-ledger',
  instrumentations: [getNodeAutoInstrumentations(), new HapiInstrumentation()],
  traceExporter: exporter
  // spanProcessor: new SimpleSpanProcessor(new ZipkinExporter())
})
sdk.start()
