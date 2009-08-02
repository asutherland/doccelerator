var Widgets = {
  /**
   * Things what live in the sidebar.
   */
  sidebar: {
  },
  /**
   * Body widgets based on docthing types.
   */
  body: {
  },
  /**
   * Widgets that get added on to body widgets.  Comments are the only user
   *  right now, but I could also envision performance data, unit test failures,
   *  exposure that a pending patch touches things, etc. all using this
   *  mechanism.
   */
  bodyDecorators: {
  },
  /**
   * Things that go in the toolbar that shows up for each thing in the body.
   */
  itemToolbar: {
  },

  /**
   * Simple/hackjob actions to expose via the "Controls" box.  Almost nothing in
   *  here/that gets added to here should actually be here.
   */
  commands: {
    "Refresh UI": function() {
      Widgets.refreshAll();
    }
  },

  _initialized: false,
  serializationAliases: {},
  /**
   * Refresh (and initialize) widgets.  This must be called at startup before
   *  anything interesting happens.
   */
  refreshAll: function Widgets_refreshAll() {
    var key, widget;
    var initialized = this._initialized;

    for (key in Widgets.sidebar) {
      widget = Widgets.sidebar[key];
      if (!initialized && "init" in widget)
        widget.init();
      if ("refresh" in widget)
        widget.refresh();
    }

    for (key in Widgets.body) {
      widget = Widgets.body[key];
      if (!initialized && "init" in widget)
        widget.init();
      if (widget.alias)
        this.serializationAliases[widget.alias] = key;
    }

    this._initialized = true;
  },

  _compareWidgetsByPositionAndName:
      function Widgets__compareWidgetsByPositionAndName(a, b) {
    // use the icon as a proxy for name for now
    if (a.desiredPosition == b.desiredPosition)
      return a.icon.localeCompare(b.icon);
    return a.desiredPosition - b.desiredPosition;
  },

  /**
   * Find all the widgets applicable to the thing.  The decision is made
   *  based on the appliesTo value/dictionary on the widget and the type of the
   *  thing.
   *
   * @param aWidgets A widget dictionary such as |Widgets.itemToolbar| or
   *     |Widgets.bodyDecorators|.
   * @param aThing The thing to see if they are appropriate for.
   *
   * @return {Array} A list of appropriate widgets sorted based on their desired
   *     position and name.
   */
  findApplicable: function Widgets_findApplicable(aWidgets, aThing) {
    var eligible = [];
    for (var widgetName in aWidgets) {
      var widget = aWidgets[widgetName];
      if (widget.appliesTo === true ||
          ((aThing.type in widget.appliesTo) &&
           widget.appliesTo[aThing.type]) ||
          (!(aThing.type in widget.appliesTo) &&
           widget.appliesTo._default))
        eligible.push(widget);
    }

    eligible.sort(this._compareWidgetsByPositionAndName);

    return eligible;
  }
};

Widgets.sidebar.control = {
  refresh: function() {
    var jContent = $("<ul></ul>").appendTo($("#control .content").empty());
    for (var key in Widgets.commands) {
      var item = $("<li></li>")
        .appendTo(jContent);
      $("<a></a>")
        .text(key)
        .click(Widgets.commands[key])
        .appendTo(item);
    }
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

function Activity(aEntireNode, aDescNode, aProgressBar) {
  this.node = aEntireNode;
  this.descNode = aDescNode;
  this.progressBar = aProgressBar;
}
Activity.prototype = {
  setStatus: function(aPhase, aProgress) {
    this.progressBar.progressbar("value", Math.floor(aProgress * 100));
  },
  done: function() {
    this.node.remove();
  }
};

Widgets.sidebar.activities = {
  liveActivityCount: 0,
  init: function() {
    $("#activities").hide();
  },
  start: function Widget_activities_start(aDesc) {
    var jContent = $("#activities .content");
    var node = $("<div></div>")
      .appendTo(jContent);
    var description = $("<span></span>")
      .text(aDesc)
      .appendTo(node);
    var progressBar = $("<div></div>")
      .progressbar()
      .appendTo(node);

    if (this.liveActivityCount == 0)
      $("#activities").show();
    this.liveActivityCount++;

    var activity = new Activity(node, description, progressBar);
    return activity;
  },
  _activityDone: function Widget_activities__activityDone() {
    this.liveActivityCount--;
    if (this.liveActivityCount == 0)
      $("#activities").hide();
  }
};

Widgets.sidebar.remember = {
  init: function() {
  }
};

Widgets.body["default"] = {
  show: function(aNode, aThing) {
    aNode.append(UI.format.docStream(aThing.docStream, aThing));
  },
  serializeAs: "reference"
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
  },
  // files are synthetic constructs currently, so we can just invent the node
  alias: "f",
  serialize: function(aFile) {
    return aFile.fullName;
  },
  deserialize: function(aFullName) {
    return {
      name: aFullName.substring(aFullName.lastIndexOf("/")+1),
      fullName: aFullName
    };
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
  },
  alias: "t",
  serialize: function(aType) {
    return aType.name;
  },
  deserialize: function(aTypeName) {
    return {
      name: aTypeName.substring(aTypeName.lastIndexOf(".")+1),
      fullName: aTypeName
    };
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
                   docs, false, ["file"]));
  },
  alias: "n",
  serialize: function(aReference) {
    return aReference.fullName;
  },
  deserialize: function(aRefName) {
    return {
      name: aRefName.substring(aRefName.lastIndexOf(".")+1),
      fullName: aRefName
    };
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
  },
  serialize: function(aReferences) {
    return aReferences.thing.fullName;
  },
  deserialize: function(aReferenced) {
    return {
      name: aReferenced,
      fullName: _("references:") + aReferenced,
      thing: {
        fullName: aReferenced
      }
    };
  }
};

Widgets.body["class"] = {
  prepareToShow: function(aClass, aCallback) {
    fldb.getDocs("by_parent", aClass.fullName, aCallback);
  },
  show: function(aNode, aClass, aDocs) {
    aNode.append(UI.format.typeListWithHeading(
                   _("Inherits From"),
                   aClass.subclasses));

    aNode.append(UI.format.docStream(aClass.docStream, aClass));

    var groups = UIUtils.categorizeClassParts(aDocs);
    aNode.append(UI.format.categorizedBriefs(groups));
  },
  serializeAs: "type"
};

Widgets.body.method = {
  show: function(aNode, aMethod) {
    aNode.append(UI.format.docStream(aMethod.docStream, aMethod));

    if (aMethod.params)
      aNode.append(UI.format.paramsWithHeading(aMethod));
    if (aMethod.returns)
      aNode.append(UI.format.returnWithHeading(aMethod));
  },
  serializeAs: "reference"
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

Widgets.itemToolbar.comment = {
  icon: "pencil",
  label: _("Comment"),
  desiredPosition: 20,
  appliesTo: true,
  // when clicked, we want to add a new doc block.
  onClick: function(aDocWidget, aThing) {
    User.ensureUsername(function(aUsername) {
      Widgets.bodyDecorators.comment.newComment(aThing, aDocWidget, aUsername);
    });
  }
};

Widgets.bodyDecorators.comment = {
  appliesTo: true,
  _makeWidget: function(aDocWidget, aComment) {
    var box = $("<div></div>")
      .addClass("comment-box")
      .data("what", aComment)
      .appendTo(aDocWidget);
    var userSays = $("<div></div>")
      .text(aComment.author + " adds...")
      .appendTo(box);
    var timeoutActive = false;
    var area;
    // make it editable if the current user is the author
    if (aComment.author == User.username) {
      area = $("<textarea></textarea>")
        .addClass("comment-edit-text")
        .text(aComment.comment)
        .keypress(function() {
                    if (!timeoutActive) {
                      timeoutActive = true;
                      setTimeout(function() {
                        timeoutActive = false;
                        aComment.comment = area.val();
                        Widgets.bodyDecorators.comment._saveComment(aComment);
                      }, 5000);
                    }
                  });
    }
    else {
      area = $("<pre></pre>")
        .addClass("comment-display-text")
        .text(aComment.comment);
    }
    area.appendTo(box);
    $.scrollTo(box, 400);
  },
  _saveComment: function Widgets_comment__saveComment(aComment) {
    DB.saveDoc(aComment);
  },
  newComment: function Widgets_comment_newComment(aThing, aDocWidget,
                                                  aUsername) {
    var comment = {
      type: "comment",
      author: aUsername,
      comment: "",
      commentOn: aThing.fullName
    };
    this._makeWidget(aDocWidget, comment);
  },
  showComment: function Widgets_comment_showComment(aThing, aDocWidget,
                                                    aComment) {
    this._makeWidget(aDocWidget, aComment);
  },
  decorate: function Widgets_comment_decorate(aThing, aDocWidget) {
    fldb.getDocs("comments_on_fullname", aThing.fullName, function(aDocs) {
      for (var iDoc = 0; iDoc < aDocs.length; iDoc++) {
        var comment = aDocs[iDoc];
        Widgets.bodyDecorators.comment.showComment(aThing, aDocWidget, comment);
      }
    });
  }
};
