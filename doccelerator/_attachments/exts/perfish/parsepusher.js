/*
 * This file is a would-be extension for performance data and information.  This
 *  would ideally live in its own CouchApp.
 *
 * This code is written against JS 1.8.  This performance tooling is currently
 *  mozilla specific on many fronts, so I have no problem doing this.
 */


function ProfileParser(aRepoDefs) {
  this.repos = aRepoDefs;

  // - fuse the chrome and module path maps
  this.chrome_map = {};
  this.module_map = {};

  for (var iRepo = 0; iRepo < aRepoDefs.length; iRepo++) {
    var repo = aRepoDefs[iRepo];
    $.extend(this.chrome_map, repo.path_maps["chrome"]);
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
    if (this._reFile.test(aPath)) {
      // strip down to the dist subdir paths, then correct that
      let idx = aPath.indexOf("dist/bin/modules/") + 17;
      let module_path = aPath.substring(idx);
      if (module_path in this.module_map)
        return this.module_map[module_path];
      throw new Error("Unable to map module path: " + module_path);
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
    let last_func_info = null;
    for each (let [, line] in Iterator(aJSLines)) {
      let c2 = line.lastIndexOf(":");
      let c1 = line.lastIndexOf(":", c2-1);
      let path = line.substring(1, c1);
      let funcName = line.substring(c1+1, c2);
      let line = parseInt(line.substring(c2+1));

      // normalize the path, computing and caching if not already cached
      if (path in this.cached_paths)
        path = this.cached_paths[path];
      else
        path = this.cached_paths[path] = this._norm_path(path);
      // native functions
      if (path == "native") {
        // just skip completely useless native frames
        if (funcName == "<none>")
          continue;
        // Useful native frames have a function name, but that's it (for now).
        //  Use the name as the line number for them.
        line = funcName;
      }

      let file_line_map = (path in this.files) ? this.files[path]
                                               : this.files[path] = {};

      let func_info;
      if (line in file_line_map) {
        func_info = file_line_map[line];
      }
      else {
        this.func_count++;
        func_info = file_line_map[line] = {
          funcName: func,
          branch_samples: 0,
          leaf_samples: 0
        };
      }

      if (last_func_info) {

      }

      last_func_info = func_info;
    }

    if(last_func_info)
      last_func_info.leaf_samples++;
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

  _parseDriver: function ProfileParser__parseDriver(aThis) {
    // !!! no 'this' !!!
    let status = aThis._parseGenerator.next();
    if (status) {
      let progress;
      if (status[0] == "parsing")
        progress = status[1] / aThis.total_lines;
      else
        progress = status[1] / aThis.func_count;
      aThis._progress.setStatus(status[0], progress);

      // reschedule ourselves
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
        yield ["parsing", iLine];

      if (firstChar == "*") {
        if (timestamp)
          this._chew_block(timestamp, js_lines);

        match = reTStamp.exec(line);
        timestamp = parseInt(match[1], 16);
        // wordswap
        timestamp = (timestamp >> 32) | ((timestamp & 0xffffffff) << 32);
        js_lines = [];
      }
      // "JS stack:".  throw it away
      else if (firstChar == "J") {
      }
      // it's a JS stack entry, save it to process once we've seen all of this
      //  block
      else if (firstChar == " ") {
        js_lines.push(line);
      }
      // unknown => asplode
      else {
        throw new Error("Do not know how to parse line: " + line);
      }
    }
    if (timestamp)
      this._chew_block(timestamp, js_lines);

    // --- Post-process the function aggregations into class aggregates.


    yield null;
  }
};
