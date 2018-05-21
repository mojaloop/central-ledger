var test = require('tape');
var sinon = require('sinon');

var proxyquire = require('proxyquire');

test('userController calls userService.getUser', function (t) {
  var user = { username: 'ponyfoo', id: 1234 };
  var getUser = sinon.spy();
  var userController = proxyquire('../controllers/user', {
    '../services/user': { getUser: getUser }
  });

  userController.prepareModel(wrapUp);

  t.equal(getUser.firstCall.args[0], 1234);
  t.equal(typeof getUser.firstCall.args[1], 'function');

  getUser.firstCall.args[1](null, user);

  function wrapUp (err, model) {
    t.equal(err, null);
    t.equal(model.username, 'ponyfoo');
    t.notOk('id' in model);
    t.end();
  }
});
