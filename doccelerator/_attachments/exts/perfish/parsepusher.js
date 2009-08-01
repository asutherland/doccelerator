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
    }
    else if (this._reChrome.test(aPath)) {
    }
    else if (this._reNull.test(aPath)) {

    }
    else {
      throw new Error("Unknown path format: " + aPath);
    }
  },

  _chew_block: function ProfileParser__chew_block(aTimestamp, aJSLines) {
    for each (let [, line] in Iterator(aJSLines)) {
      let c2 = line.lastIndexOf(":");
      let c1 = line.lastIndexOf(":", c2-1);
      let path = line.substring(1, c1);
      let funcName = line.substring(c1+1, c2);
      let line = parseInt(line.substring(c2+1));

    }
  },

  /**
   * Parse a profile output run
   */
  parse: function ProfileParser_parse(aLineGenerator) {
    // map aliased files to file info
    this.files = {};

    const reTStamp = /^\*\*\* TIME: (\d+)/;

    let timestamp = null;
    let js_lines = null;

    // --- Parse the trace, creating invocation summaries for functions and file
    //     aggregations.
    for each (let [, line] in Iterator(aLineGenerator)) {
      let match;
      let firstChar = line[0];

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


  }
};
