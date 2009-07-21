function (newDoc, oldDoc, userCtx) {
  var type = (oldDoc || newDoc)['type'];
  var author = (oldDoc || newDoc)['author'];

  function forbidden(message) {
    throw({forbidden : message});
  };

  function unauthorized(message) {
    throw({unauthorized : message});
  };

  function require(beTrue, message) {
    if (!beTrue) forbidden(message);
  };

  // comments are un-authenticated
  if (type == "comment")
    return;

  // docs with authors can only be saved by their author
  if (author) {
    // dirty hack to provide userCtx.name to the client process
    if (author == '_self')
      userCtx.name ? forbidden('_self:' + userCtx.name) : unauthorized('Please log in.');
  }

  if (userCtx.roles.indexOf('_admin') == -1)
    forbidden("Only the admin can do something interesting.");
}
