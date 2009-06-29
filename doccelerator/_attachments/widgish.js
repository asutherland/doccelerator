var Widgets = {
  /**
   * Things what live in the sidebar.
   */
  sidebar: {
  },
  /**
   * Ways to handle things in the body?  Not used yet.
   */
  body: {
  },
  _initialized: false,
  refreshAll: function() {
    var key, widget;
    var initialized = this._initialized;
    for (key in Widgets.sidebar) {
      widget = Widgets.sidebar[key];
      if (!initialized && "init" in widget)
        widget.init();
      if ("refresh" in widget)
        widget.refresh();
    }
    this._initialized = true;
  },
  /**
   * Things that go in the toolbar that shows up for each thing in the body.
   */
  itemToolbar: {
  }
};

Widgets.sidebar.files = {
  refresh: function() {
    var dis = this;
    DB.view(design + "/by_file", {
              reduce: true, group:true,
              success: function(data) {
                dis._gotFiles(data);
              },
              error: function() {
                Log.warning("Failure retrieving list of files.");
              }
            });
  },
  _gotFiles: function(aData) {
    var jContent = $("<ul></ul>").appendTo($("#files .content").empty());
    var dis = this;
    var files = [];
    var iRow;
    for (iRow = 0; iRow < aData.rows.length; iRow++) {
      var row = aData.rows[iRow];
      var basename = row.key.substring(row.key.lastIndexOf('/') + 1);
      files.push({type: "file",
                  label: row.key,
                  name: basename,
                  fullName: row.key});
    }

    var treeified = UIUtils.treeifyPaths(files, "label");
    function renderTree(aNode, aStray) {
      // handle if this is a new tree node
      if (typeof(aStray[0]) == "string") {
        var dirInfo = $("<li></li>")
          .text(aStray[0])
          .appendTo(aNode);
        var newNode = $("<ul></ul>")
          .appendTo(dirInfo);
        if (aStray.length > 1)
          renderTree(newNode, aStray.slice(1));
        return;
      }
      // process the elements in the list
      for (var i = 0; i < aStray.length; i++) {
        var subStray = aStray[i];
        if (subStray.length) {
          renderTree(aNode, subStray);
        }
        else {
          $("<li></li>")
            .append($("<a></a>")
              .text(subStray.label)
              .addClass("file-name")
              .data("what", subStray)
              .click(UI.showClick))
            .appendTo(aNode);
        }
      }
    }
    renderTree(jContent, treeified);
  },
  _showFile: function() {
    UI.showFile($(this).text());
  }
};

Widgets.sidebar.remember = {
  init: function() {
  }
};

Widgets.body["default"] = {
  show: function(aNode, aThing) {
    aNode.append(UI.format.docStream(aThing.docStream, aThing));
  }
};

/**
 * Provides a top-level summary of source files.
 */
Widgets.body.file = {
  prepareToShow: function(aFile, aCallback) {
    fldb.getFileDocs("interesting", aFile.fullName, aCallback);
  },
  show: function(aNode, aFile, aDocs) {
    aNode.append(UI.format.briefsWithHeading(
                   _("Globals"),
                   DBUtils.filterDocsByType(aDocs, "global"),
                   true));
    aNode.append(UI.format.briefsWithHeading(
                   _("Classes"),
                   DBUtils.filterDocsByType(aDocs, "class")));
    aNode.append(UI.format.briefsWithHeading(
                   _("Functions"),
                   DBUtils.filterDocsByType(aDocs, "function")));
  }
};

/**
 * Bounces types to the proper widget display after retrieving the type info.
 * Types are merely abstract references where we are assuming there is an
 *  underlying type.
 */
Widgets.body.type = {
  prepareToShow: function(aType, aCallback) {
    fldb.getDocs("by_type", aType.name, function(docs) {
                   // if there is just one match, use the special callback
                   //  mechanism to cause show to show something else.
                   if (docs.length == 1)
                     aCallback(null, docs[0]);
                   else
                     aCallback(docs);
                 });
  },
  show: function(aNode, aType, aDocs) {
    // if we are here, then aDocs.length == 0 or > 1

    // Show an unhelpful failure block for nothing found
    if (aDocs.length == 0) {
      $("<span></span>")
        .text(_("Unknown type. Sorry you had to find out this way."))
        .appendTo(aNode);
      return;
    }

    // otherwise, should a conflict resolution block...
    aNode.append(UI.format.briefsWithHeading(
                   _("Conflicting Types"),
                   aDocs));
  }
};

/**
 * Similar to type, except we bounce based on name lookup and bias towards
 *  fullName over just name to avoid erroneous shadowing.
 */
Widgets.body.reference = {
  prepareToShow: function(aReference, aCallback) {
    fldb.getRows("by_name", aReference.fullName, function(rows) {
                   // if there is just one match, use the special callback
                   //  mechanism to cause show to show something else.
                   if (rows.length == 1)
                     return aCallback(null, rows[0].doc);
                   // just one fullName match?  use it
                   var fullNameRows =
                     $.grep(rows, function(aRow) {
                              return aRow.value;
                            });
                   if (fullNameRows.length == 1)
                     return aCallback(null, fullNameRows[0].doc);
                   // conflict time! :(
                   if (fullNameRows.length)
                     return aCallback(fullNameRows);
                   else
                     return aCallback(rows);
                 });
  },
  show: function(aNode, aType, aRows) {
    var docs = fldb.rowsToDocs(aRows);
    // if we are here, then docs.length == 0 or > 1

    // Show an unhelpful failure block for nothing found
    if (docs.length == 0) {
      $("<span></span>")
        .text(_("Unknown reference. Sorry you had to find out this way."))
        .appendTo(aNode);
      return;
    }

    // otherwise, should a conflict resolution block...
    aNode.append(UI.format.briefsWithHeading(
                   _("Conflicting Types"),
                   docs));
  }
};

Widgets.body.references = {
  prepareToShow: function(aReferences, aCallback) {
    fldb.getDocs("references", aReferences.thing.fullName, aCallback);
  },
  show: function(aNode, aReferences, aDocs) {
    aNode.append(UI.format.briefsWithHeading(
                   _("Referenced By"),
                   aDocs));
  }
};

Widgets.body["class"] = {
  prepareToShow: function(aClass, aCallback) {
    fldb.getDocs("by_parent", aClass.fullName, aCallback);
  },
  show: function(aNode, aClass, aDocs) {
    aNode.append(UI.format.docStream(aClass.docStream, aClass));

    aNode.append(UI.format.briefsWithHeading(
                   _("Methods"),
                   DBUtils.filterDocsByType(aDocs, "method")));
    aNode.append(UI.format.briefsWithHeading(
                   _("Fields"),
                   DBUtils.filterDocsByType(aDocs, "field")));
    aNode.append(UI.format.briefsWithHeading(
                   _("Getters"),
                   DBUtils.filterDocsByType(aDocs, "getter")));
    aNode.append(UI.format.briefsWithHeading(
                   _("Setters"),
                   DBUtils.filterDocsByType(aDocs, "setter")));
  }
};

Widgets.body.method = {
  show: function(aNode, aMethod) {
    aNode.append(UI.format.docStream(aMethod.docStream, aMethod));

    if (aMethod.params)
      aNode.append(UI.format.paramsWithHeading(aMethod));
    if (aMethod.returns)
      aNode.append(UI.format.returnWithHeading(aMethod));
  }
};

Widgets.itemToolbar.close = {
  icon: "close",
  label: _("Close"),
  // be last
  desiredPosition: 1000000,
  appliesTo: true,
  onClick: function(aDocWidget, aThing) {
    UI.remove(aDocWidget);
  }
};

Widgets.itemToolbar.remember = {
  icon: "heart",
  label: _("Remember"),
  tooltip: _("Remember for later"),
  desiredPosition: -1000000,
  appliesTo: true,
  onClick: function(aDocWidget, aThing) {
    var node = $("<li></li>");
    $("<span></span>")
      .text(aThing.fullName)
      .addClass(aThing.type + "-name")
      .data("what", aThing)
      .click(UI.showClick)
      .appendTo(node);
    $("<span class='inline-icon ui-icon-trash'></span>")
      .click(function () {
               $(this).parent().remove();
             })
      .appendTo(node);
    node.appendTo("#remember .content");
  }
};

Widgets.itemToolbar.referencedBy = {
  icon: "search",
  label: _("Referenced By"),
  desiredPosition: 10,
  appliesTo: {
    file: false,
    _default: true
  },
  onClick: function(aDocWidget, aThing) {
    var refThing = {
      type: "references",
      // the fullName and name become simply a display hack for now
      fullName: _("references:") + aThing.fullName,
      name: aThing.fullName,
      thing: aThing,
    };
    UI.show(refThing, aDocWidget);
  }
};