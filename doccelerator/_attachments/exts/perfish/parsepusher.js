/*
 * This file is a would-be extension for performance data and information.  This
 *  would ideally live in its own CouchApp.
 *
 * This code is written against JS 1.8.  This performance tooling is currently
 *  mozilla specific on many fronts, so I have no problem doing this.
 */

var curPerfProf = {
  trace_file: "/vms/jaunty-i386/vprobe.out",
  db_name: "perfish",
};

var gPerfParse;
Widgets.commands["ParsePerf"] = function() {
  User.attemptLogin(function() {
    gPerfParse = new ProfileParser([thunderbirdRepo, mozilla191Repo],
                                   curPerfProf);
    gPerfParse.startParse(curPerfProf.trace_file);
  });
};

function ProfileParser(aRepoDefs, aPerfProfDef) {
  this.repos = aRepoDefs;
  this.prof = aPerfProfDef;

  // - fuse the chrome and module path maps
  this.chrome_map = {};
  this.component_map = {};
  this.module_map = {};

  for (var iRepo = 0; iRepo < aRepoDefs.length; iRepo++) {
    var repo = aRepoDefs[iRepo];
    $.extend(this.chrome_map, repo.path_maps["chrome"]);
    $.extend(this.component_map, repo.path_maps["component"]);
    $.extend(this.module_map, repo.path_maps["module"]);
  }
}

ProfileParser.prototype = {
  _reFile: /^file:\/{3}/,
  _reChrome: /^chrome:\/{2}/,
  _reNull: /^<NULL:/,
  /**
   * Normalize paths into source/origin paths.  Input paths are either chrome
   *  URLs or, in the case of modules, file URLs to the installed dist path.
   */
  _norm_path: function ProfileParser__norm_path(aPath) {
    // module or component
    if (this._reFile.test(aPath)) {
      // strip down to the dist subdir paths, then correct that
      let idxModule = aPath.indexOf("dist/bin/modules/");
      if (idxModule != -1) {
        idxModule += 17;
        let module_path = aPath.substring(idxModule);
        if (module_path in this.module_map)
          return this.module_map[module_path];
        throw new Error("Unable to map module path: " + module_path);
      }
      let idxComponent = aPath.indexOf("dist/bin/components/");
      if (idxComponent != -1) {
        idxComponent += 20;
        let component_path = aPath.substring(idxComponent);
        if (component_path in this.component_map)
          return this.component_map[component_path];
        throw new Error("Unable to map component path: " + component_path);
      }
      throw new Error("Don't know how to transform file path: " + aPath);
    }
    else if (this._reChrome.test(aPath)) {
      let chrome_path = aPath.substring(9);
      if (chrome_path in this.chrome_map)
        return this.chrome_map[chrome_path];
      throw new Error("Unable to map chrome path: " + chrome_path);
    }
    else if (this._reNull.test(aPath)) {
      return "native";
    }
    else {
      throw new Error("Unknown path format: " + aPath);
    }
  },

  _chew_block: function ProfileParser__chew_block(aTimestamp, aJSLines) {
    // The first stack frame is the current stack frame, and each subsequent
    //  frame is the parent frame of the preceding frame.  called_func_info
    //  is the function info for the previous line (and frame)
    let called_func_info = null;
    for each (let [, line] in Iterator(aJSLines)) {
      let c2 = line.lastIndexOf(":");
      let c1 = line.lastIndexOf(":", c2-1);
      let path = line.substring(1, c1);
      let func_name = line.substring(c1+1, c2);
      let line_num = parseInt(line.substring(c2+1));

      // normalize the path, computing and caching if not already cached
      if (path in this.cached_paths)
        path = this.cached_paths[path];
      else
        path = this.cached_paths[path] = this._norm_path(path);
      // native functions
      if (path == "native") {
        // just skip completely useless native frames
        if (func_name == "<none>")
          continue;
        // Useful native frames have a function name, but that's it (for now).
        //  Use the name as the line number for them.
        line_num = func_name;
      }

      let canonical_name = path + ":" + line_num;

      let file_line_map = (path in this.files) ? this.files[path]
                                               : this.files[path] = {};

      let func_info;
      if (line_num in file_line_map) {
        func_info = file_line_map[line_num];
      }
      else {
        func_info = file_line_map[line_num] = {
          canonical_name: canonical_name,
          src_path: path,
          line: line_num,
          func_name: func_name,
          branch_samples: 0,
          leaf_samples: 0,
          // Maps canonical name to the number of times the given canonical name
          //  was observed as called on the stack.  If a call shows up multiple
          //  times in a stack, each call gets counted.
          called: {},
        };
        this.func_docs.push(func_info);
      }

      if (!called_func_info) {
        func_info.leaf_samples++;
      }
      else {
        func_info.branch_samples++;
        if (!(called_func_info.canonical_name in func_info.called))
          func_info.called[called_func_info.canonical_name] = 1;
        else
          func_info.called[called_func_info.canonical_name]++;
      }
      called_func_info = func_info;
    }
  },

  startParse: function ProfileParser_startParse(aUrl) {
    let dis = this;
    $.ajax({type: "GET",
            url: aUrl,
            dataType: "text",
            success: function (aData) {
              let lines = aData.split("\n");
              dis.total_lines = lines.length;
              dis._parseGenerator = dis._parse(lines);
              dis._progress =
                Widgets.sidebar.activities.start("Parsing Profile");
              setTimeout(dis._parseDriver, 0, dis);
            }
           });
  },

  _parseDriver: function ProfileParser__parseDriver(aThis, aArg, aLateness) {
    // REMEMBER: no (valid) 'this' in here
    let status;
    if (aLateness !== undefined)
      status = aThis._parseGenerator.send(aArg);
    else
      status = aThis._parseGenerator.next();

    // status is of the form:
    // [phase string, phase progress, schedule via timer?]
    if (status) {
      let progress;
      if (status[0] == "parsing")
        progress = status[1] / aThis.total_lines;
      else if (status[0] == "chewing")
        progress = status[1] / aThis.func_docs.length;
      else
        progress = status[1];
      aThis._progress.setStatus(status[0], progress);

      // reschedule ourselves if required.  (it's possible an async notification
      //  will kick us.)
      if (status[2])
        setTimeout(aThis._parseDriver, 50, aThis);
    }
    else {
      aThis._progress.done();
    }
  },

  /**
   * Parse a profile output run
   */
  _parse: function ProfileParser__parse(aLineGenerator) {
    // map aliased files to file info
    this.files = {};
    this.cached_paths = {};
    this.func_count = 0;
    this.func_docs = [];

    let dis = this;
    let driverCallback = function() {
                           dis._parseDriver(dis, 0);
                         };

    // create the db, nuking it first if it already exists
    this.db = $.couch.db(this.prof.db_name);
    this.db.uri = urlbase + this.prof.db_name + "/";
    this.db.drop({success: driverCallback, failure: driverCallback});
    yield ["db init", 25, false];
    this.db.create({success: driverCallback});
    yield ["db init", 50, false];
    this.db.saveDoc({
      _id: "_design/perfish",
      views: {
        by_loc: {
          map: "function(doc) { \
  if (doc.src_path && doc.line) \
    emit([doc.src_path, doc.line], null); \
}"
        },
        by_leaf_count: {
          map: "function(doc) { \
  emit(doc.leaf_samples, null);\
}"
        },
        by_branch_count: {
          map: "function(doc) { \
  emit(doc.branch_samples, null);\
}"
        },
        by_total_count: {
          map: "function(doc) { \
  emit(doc.leaf_samples + doc.branch_samples, null);\
}"
        }
      }
    }, {success: driverCallback});
    yield ["db init", 75, false];

    const reTStamp = /^\*\*\* TIME: (\d+)/;

    const yieldEvery = 1000;

    let timestamp = null;
    let js_lines = null;

    // --- Parse the trace, creating invocation summaries for functions and file
    //     aggregations.
    for each (let [iLine, line] in Iterator(aLineGenerator)) {
      let match;
      let firstChar = line[0];

      if (iLine % yieldEvery == 0)
        yield ["parsing", iLine, true];

      if (firstChar == "*") {
        if (timestamp)
          this._chew_block(timestamp, js_lines);

        match = reTStamp.exec(line);
        timestamp = parseInt(match[1], 16);
        // wordswap
        timestamp = (timestamp >> 32) | ((timestamp & 0xffffffff) << 32);
        js_lines = [];
      }
      // "JS stack:". ignore.
      else if (firstChar == "J") {
        // throw it away, nop style
      }
      // it's a JS stack entry, save it to process once we've seen all of this
      //  block
      else if (firstChar == " ") {
        js_lines.push(line);
      }
      // unknown => asplode
      else {
        line = line.trim();
        if (line)
          throw new Error("Do not know how to parse line: " + line);
      }
    }
    if (timestamp)
      this._chew_block(timestamp, js_lines);

    // --- Post-process the function aggregations into class aggregates.

    // --- Fix-up Documents with UUIDs
    $.get(urlbase + "_uuids", {count: this.func_docs.length},
          function (data) {
            dis._parseDriver(dis, data, 0);
          },
          "json");
    let data = yield ["saving docs", 0, false];
    let uuids = data.uuids;

    for each (let [iFuncInfo, func_info] in Iterator(this.func_docs)) {
      func_info._id = uuids[iFuncInfo];
    }
    this.db.bulkSave(this.func_docs, {
                       success: driverCallback
                     });
    yield ["saving docs", 20, false];


    yield null;
  }
};
