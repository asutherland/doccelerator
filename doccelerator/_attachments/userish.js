var User = {
  username: null,
  attemptLogin : function(win, fail) {
    DB.saveDoc({"author":"_self"}, {
                 error: function(s, e, r) {
                   var namep = r.split(':');
                   if (namep[0] == '_self') {
                     User.username = namep.pop();
                     $.cookies.set("login", username, urlbase + dbname);
                     win && win(login);
                   } else {
                     $.cookies.set("login", "", urlbase + dbname);
                     fail && fail(s, e, r);
                   }
                 }});
  },
};