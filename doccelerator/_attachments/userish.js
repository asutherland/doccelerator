var User = {
  username: null,
  // torn from the pages of jquery.couchapp.sjtw
  /**
   * Try and do a proper authentication that gives us actual couch credentials.
   *  This triggers the normal user/password dialog.  We get the username back
   *  from the couch as a side-effect of a successful login.
   */
  attemptLogin : function(win, fail) {
    DB.saveDoc({"author":"_self"}, {
                 error: function(s, e, r) {
                   var namep = r.split(':');
                   if (namep[0] == '_self') {
                     User.username = namep.pop();
                     $.cookies.set("login", User.username, urlbase + dbname);
                     win && win(User.username);
                   } else {
                     $.cookies.set("login", "", urlbase + dbname);
                     fail && fail(s, e, r);
                   }
                 }});
  },

  init: function User_init() {
    $("#namedialog").dialog(this._nameDialogOpts);
    this.username = $.cookies.get("username");
  },

  _pendingDialogCallback: null,
  _nameDialogOpts: {
    autoOpen: false,
    modal: true,
    close: function User_nameDialog_close(event, ui) {
      User.username = $("#dia-username").val();
      if (User.username) {
        $.cookies.set("username", User.username, urlbase + dbname);
        var callback = User._pendingDialogCallback;
        User._pendingDialogCallback = null;
        callback(User.username);
      }
    },
    buttons: {
      "Ok": function() {
        $(this).dialog("close");
      }
    }
  },

  /**
   * Ensure that we have a username, calling the provided callback if we have
   *  one or are able to compel the user to enter one.  If the user cancels out,
   *  we do not call the callback.
   */
  ensureUsername: function(aCallback) {
    // If we already have a user name, call the callback immediately.
    // Check the cookie too.
    if (this.username || (this.username = $.cookies.get("username"))) {
      aCallback(this.username);
      return;
    }

    this._pendingDialogCallback = aCallback;
    // otherwise show the stupid dialog
    $("#namedialog").dialog("open");
  }
};
