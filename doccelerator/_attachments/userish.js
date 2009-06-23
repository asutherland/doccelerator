var User = {
  username: null,
  // torn from the pages of jquery.couchapp.sjtw
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
};