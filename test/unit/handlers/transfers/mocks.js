const createTracerStub = (sandbox, context = {}) => {
  /* eslint-disable prefer-const */
  let SpanStub
  SpanStub = {
    audit: sandbox.stub().callsFake(),
    error: sandbox.stub().callsFake(),
    finish: sandbox.stub().callsFake(),
    debug: sandbox.stub().callsFake(),
    info: sandbox.stub().callsFake(),
    getChild: sandbox.stub().returns(SpanStub),
    setTags: sandbox.stub().callsFake(),
    injectContextToMessage: sandbox.stub().callsFake(msg => msg)
  }

  const TracerStub = {
    extractContextFromMessage: sandbox.stub().callsFake(() => context),
    createChildSpanFromContext: sandbox.stub().callsFake(() => SpanStub)
  }

  return { TracerStub, SpanStub }
}

module.exports = {
  createTracerStub
}
