/**
 * Process a repository definition.
 *
 * Builds the following attribute structures:
 * - files: A list of repo-relative file names.
 * - path_maps: Contains dictionaries for each attributes of the form FOO_path
 *    found on directory definitions in the 'dirs' list.  Each key in the
 *    dictionary is a path built by appending the file names of the 'files'
 *    listed in the directory definition to the value found in FOO_path.  Each
 *    value is the repo-relative file path.
 */
function explodeRepo(aRepoDef) {
  aRepoDef.files = [];
  aRepoDef.path_maps = {};
  aRepoDef.file_to_subsystem = {};

  var rePath = /^(.+)_path$/;

  for (var iDir = 0; iDir < aRepoDef.dirs.length; iDir++) {
    var dir = aRepoDef.dirs[iDir];
    var subsystem = ("subsystem" in dir) ? dir.subsystem : null;

    // assume at most one magic path_map contribution per dir
    var mapped_path_name = null;
    var mapped_path_value = null;
    var mapped_path_dict = null;
    for (var key in dir) {
      if (rePath.test(key)) {
        mapped_path_name = rePath.exec(key)[1];
        mapped_path_value = dir[key];
        if (mapped_path_name in aRepoDef.path_maps)
          mapped_path_dict = aRepoDef.path_maps[mapped_path_name];
        else
          mapped_path_dict = aRepoDef.path_maps[mapped_path_name] = {};
        break;
      }
    }

    for (var iFile = 0; iFile < dir.files.length; iFile++) {
      var filename = dir.files[iFile];
      var repo_path = dir.path + filename;
      aRepoDef.files.push(repo_path);
      if (mapped_path_dict)
        mapped_path_dict[mapped_path_value + filename] = repo_path;
      if (subsystem)
        aRepoDef.file_to_subsystem[repo_path] = subsystem;
    }
  }

  return aRepoDef;
}

var HYDRA_FLAM_URL = "/cgi-bin/flamcgi.py";

function RepoProcessor(aRepo) {
  this.repo = aRepo;
  this.current_file = null;
  this.files_to_process = this.repo.files.concat();
  this.activity = Widgets.sidebar.activities.start(aRepo.repo_name);
  this.total_files = this.files_to_process.length;
}
RepoProcessor.prototype = {
  sync: function RepoProcessor_sync() {
    if (!this._findNextSourceFile()) {
      fldb.doneProcessing(this);
      this.activity.done();
      return true;
    }

    this.activity.setStatus(null,
      (this.total_files - this.files_to_process.length) / this.total_files);

    this._getSource();
    return false;
  },
  _findNextSourceFile: function() {
    while (this.files_to_process.length) {
      this.current_file = this.files_to_process.shift();
      var dotIndex = this.current_file.lastIndexOf(".");
      var extension = this.current_file.substring(dotIndex+1);
      // we only can process js/jsm files currently, no XBL or XUL
      if (extension == "js" ||
          extension == "jsm")
        return true;
    }

    return false;
  },
  /**
   * Initiate retrieval of the source code from the repository.
   */
  _getSource: function() {
    var dis = this;
    var url = this.repo.url_base + this.current_file;
    Log.info("Retrieving source for", this.current_file, "from", url);
    $.ajax({type: "GET",
            url: url,
            dataType: "text",
            success: function (data) {
              dis._gotSource(data);
            }
          });
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
    Log.info("Pushing file source through flamboydoc service.");
    var dis = this;
    $.ajax({
             type: "POST",
             url: HYDRA_FLAM_URL,
             dataType: "json",
             data: {
               filename: this.repo.repo_name + "/" + this.current_file,
               filedata: this.file_data
             },
             success: function (data) {
               dis._hydraSourced(data);
             }
           });
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
    Log.info("Nuking documents previously associated with the file.");
    var dis = this;
    DB.view(design + "/by_file", {
              key: this.repo.repo_name + "/" + this.current_file, reduce: false,
              include_docs: true,
              success: function(data) {
                dis._gotExisting(data);
              },
              error: function() {
                Log.error("Failure retrieving existing file documents.");
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
    Log.info("Inserting our new documents for the file.");
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
                    Log.error("Failed to insert new documents.");
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
    Log.info("Trying to make sure you are logged in...");
    User.attemptLogin(function () {
                        Log.info("Logged in as", User.username);
                        fldb._loggedInUpdateRepo(aRepo);
                      },
                      function () {
                        Log.error("Bad news on the login front...");
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

  getFileDocs: function(aWhat, aFilename, aCallback) {
    this.getDocs(aWhat + "_by_file", aFilename, aCallback);
  },
  rowsToDocs: function(aRows) {
    var docs = [];
    for (var i = 0; i < aRows.length; i++)
      docs.push(aRows[i].doc);
    return docs;
  },
  getDocs: function(aViewName, aKey, aCallback) {
    DB.view(design + "/" + aViewName, {
              key: aKey,
              include_docs: true,
              success: function(data) {
                var docs = [];
                var rows = data.rows;
                for (var i = 0; i < rows.length; i++)
                  docs.push(rows[i].doc);
                aCallback(docs);
              },
            });
  },
  getRows: function(aViewName, aKey, aCallback) {
    DB.view(design + "/" + aViewName, {
              key: aKey,
              include_docs: true,
              success: function(data) {
                aCallback(data.rows);
              },
            });
  }
};

var DBUtils = {
  /**
   * Filter a set of documents by their type.
   */
  filterDocsByType: function UI__filterDocsByType(aDocs, aType) {
    var filtered = [];

    for (var i = 0; i < aDocs.length; i++) {
      var doc = aDocs[i];
      if (doc.type == aType)
        filtered.push(doc);
    }

    return filtered;
  },
};
