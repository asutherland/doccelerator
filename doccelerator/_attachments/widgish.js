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
  refreshAll: function() {
    fldb.clearCache();
    var key, widget;
    for (key in Widgets.sidebar) {
      widget = Widgets.sidebar[key];
      if ("refresh" in widget)
        widget.refresh();
    }
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
            .text(subStray.label)
            .addClass("file-name")
            .data("what", subStray)
            .click(UI.showClick)
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

/**
 * Provides a top-level summary of source files.
 */
Widgets.body.file = {
  prepareToShow: function(aFile, aCallback) {
    fldb.getFileDocs("interesting", aFile.name, function(docs) {
                       aCallback(docs);
                     });
  },
  show: function(aNode, aFile, aDocs) {
    aNode.append(this.formatBriefsWithHeading(
                   _("Globals"),
                   this._filterDocsByType(aDocs, "global")));
    aNode.append(this.formatBriefsWithHeading(
                   _("Classes"),
                   this._filterDocsByType(aDocs, "class")));
    aNode.append(this.formatBriefsWithHeading(
                   _("Functions"),
                   this._filterDocsByType(aDocs, "function")));
    node.hide();
    $("#body").prepend(node);
    node.show("blind");
  }
};

Widgets.itemToolbar.close = {
  icon: "close",
  hoverIcon: "closethick",
  tooltip: _("Close"),
  onClick: function(aDocWidget, aThing) {
    UI.remove(aDocWidget);
  }
};

Widgets.itemToolbar.remember = {
  icon: "plus",
  hoverIcon: "plusthick",
  tooltip: _("Remember for later"),

};