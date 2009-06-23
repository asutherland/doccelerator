var thunderbirdRepo = {
  url_base: '/xhr/hg/mozilla/comm-central/raw-file/tip/',
         // 'http://hg.mozilla.org/comm-central/raw-file/tip/',
  repo_name: 'comm-central',
  files: [
    'mail/base/content/folderDisplay.js',
    'mail/base/content/messageDisplay.js',

    'mailnews/base/src/dbViewWrapper.js',
    'mailnews/base/src/quickSearchManager.js',
    'mailnews/base/src/searchSpec.js',
    'mailnews/base/src/virtualFolderWrapper.js',

    'mailnews/base/util/jsTreeSelection.js',
  ]
};

var HYDRA_FLAM_URL = "/cgi-bin/flamcgi.py";

function RepoProcessor(aRepo) {
  this.repo = aRepo;
  this.current_file = null;
  this.files_to_process = this.repo.files.concat();
}
RepoProcessor.prototype = {
  sync: function RepoProcessor_sync() {
    if (!this.files_to_process.length) {
      fldb.doneProcessing(this);
      return true;
    }

    this.current_file = this.files_to_process.shift();
    this._getSource();
    return false;
  },
  /**
   * Initiate retrieval of the source code from the repository.
   */
  _getSource: function() {
    var dis = this;
    var url = this.repo.url_base + this.current_file;
    console.log("Retrieving source for", this.current_file, "from", url);
    $.get(url, null, function (data) {
            dis._gotSource(data);
          }, "text");
  },
  /**
   * We got the source code!
   */
  _gotSource: function(aData) {
    this.file_data = aData;
    this._hydraSource();
  },
  /**
   * Send the source code through the flamboydoc jshydra service.
   */
  _hydraSource: function() {
    console.log("Pushing file source through flamboydoc service.");
    var dis = this;
    $.post(HYDRA_FLAM_URL, {
             filename: this.repo.repo_name + "/" + this.current_file,
             filedata: this.file_data
           },
           function (data) {
             dis._hydraSourced(data);
           },
           "json"
          );
  },
  /**
   * We got the flamboydoc'ed results!
   */
  _hydraSourced: function(aData) {
    this.file_hydra = aData;
    this._nukeExisting();
  },
  /**
   * Kill all the previous flamboydoc'ed results associated with the file.  We
   *  do this by doing a bulk-get on everything associated with the file,
   *  and setting the _deleted field so as to mark them deleted.
   */
  _nukeExisting: function() {
    console.log("Nuking documents previously associated with the file.");
    var dis = this;
    DB.view(design + "/by_file", {
              key: this.repo.repo_name + "/" + this.current_file, reduce: false,
              include_docs: true,
              success: function(data) {
                dis._gotExisting(data);
              },
              error: function() {
                console.log("Failure retrieving existing file documents.");
              }
            });
  },
  /**
   * Receive all of the documents associated with the file, mark them deleted,
   *  then bulk save them.
   */
  _gotExisting: function(aData) {
    var deleted = [];
    var rows = aData.rows;
    for (var i = 0; i < rows.length; i++) {
      var doc = rows[i].doc;
      doc._deleted = true;
      deleted.push(doc);
    }

    var dis = this;
    DB.bulkSave(deleted, {
                  success: function() {
                    dis._insertNew();
                  }
                });
  },
  /**
   * Kick-off the insertion of the new documents.  First step is to get UUIDs
   *  for them.
   */
  _insertNew: function() {
    console.log("Inserting our new documents for the file.");
    var uuidsRequired = this.file_hydra.docs.length;
    var dis = this;
    $.get(urlbase + "_uuids", {count: uuidsRequired},
          function(data) {
            dis._gotUUIDsForInsert(data);
          },
          "json");
  },
  /**
   * Now that we have UUIDs, actually perform the bulk insert (save).
   */
  _gotUUIDsForInsert: function(aData) {
    var uuids = aData.uuids;
    var docs = this.file_hydra.docs;
    for (var i = 0; i < docs.length; i++) {
      docs._id = uuids[i];
    }
    var dis = this;
    DB.bulkSave(docs, {
                  success: function() {
                    dis._insertedNew();
                  },
                  error: function() {
                    console.log("Failed to insert new documents.");
                  }
                });
  },
  /**
   * Now the documents are inserted, see if sync has more work for us.
   */
  _insertedNew: function() {
    this.sync();
  }
};

var fldb = {
  _activeProcessors: [],
  updateRepo: function(aRepo) {
    console.log("Trying to make sure you are logged in...");
    User.attemptLogin(function () {
                        console.log("Logged in as", User.username);
                        fldb._loggedInUpdateRepo(aRepo);
                      },
                      function () {
                        console.log("Bad news on the login front...");
                      });
  },
  _loggedInUpdateRepo: function(aRepo) {
    var rp = new RepoProcessor(aRepo);
    this._activeProcessors.push(rp);
    rp.sync();
  },
  doneProcessing: function(aRepoProcessor) {
    var idx = this._activeProcessors.indexOf(aRepoProcessor);
    this._activeProcessors.splice(idx, 1);
  },

  _fileCache: {},
  clearCache: function() {
    this._fileCache = {};
  },
  getFileDocs: function(aWhat, aFilename, aCallback) {
    if (aFilename in this._fileCache) {
      aCallback(this._fileCache[aFilename]);
      return;
    }

    DB.view(design + "/" + aWhat + "_by_file", {
              key: aFilename,
              include_docs: true,
              success: function(data) {
                var docs = [];
                var rows = data.rows;
                for (var i = 0; i < rows.length; i++)
                  docs.push(rows[i].doc);
                fldb._fileCache[aFilename] = docs;
                aCallback(docs);
              },
            });
  }
};