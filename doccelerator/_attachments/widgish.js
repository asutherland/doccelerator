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
      files.push({type: "file",
                  label: row.key,
                  name: row.key,
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
            .append($("<span></span>")
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

Widgets.body.default = {
  show: function(aNode, aThing) {
    aNode.append(UI.format.docStream(aThing.docStream));
  }
};

/**
 * Provides a top-level summary of source files.
 */
Widgets.body.file = {
  prepareToShow: function(aFile, aCallback) {
    fldb.getFileDocs("interesting", aFile.name, aCallback);
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

Widgets.body["class"] = {
  prepareToShow: function(aClass, aCallback) {
    fldb.getDocs("by_parent", aClass.fullName, aCallback);
  },
  show: function(aNode, aClass, aDocs) {
    aNode.append(UI.format.docStream(aClass.docStream));

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

Widgets.body["method"] = {
  show: function(aNode, aMethod) {
    aNode.append(UI.format.docStream(aMethod.docStream));

    aNode.append(UI.format.paramsWithHeading(aMethod));
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