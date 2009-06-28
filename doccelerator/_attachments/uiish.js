var Log = {
  info: function() {
  },
  warning: function() {
  },
  error: function() {
  }
};

function _(aStr) {
  return aStr;
}

var UI = {
  /**
   * Show the given documentation 'thing', choosing an appropriate position
   *  relative to the source of the click.
   *
   * @param aThing The documentation 'thing', a document from the couch.
   * @param aWhatClick the jquery-wrapped docthing where the click originated.
   */
  show: function UI_show(aThing, aWhatClicked) {
    var widget = Widgets.body[aThing.type];
    if (widget === undefined)
      widget = Widgets.body.default;

    if (widget.prepareToShow)
      widget.prepareToShow(aThing, function(aExtra) {
                             UI._realShow(widget, aThing, aWhatClicked, aExtra);
                           });
    else
      this._realShow(widget, aThing, aWhatClicked);
  },
  _realShow: function UI__realShow(aWidget, aThing, aWhatClicked, aExtra) {
    var node = this._makeThingNode(aThing);

    aWidget.show(node, aThing, aExtra);

    node.hide();
    if (aWhatClicked && aWhatClicked.length)
      aWhatClicked.after(node);
    else
      $("#body").prepend(node);
    node.show("blind");
  },
  showClick: function UI_showClick(aEvent) {
    UI.show($(this).data("what"),
            $(aEvent.target).closest(".docthing"));
  },

  remove: function UI_remove(aDocThing) {
    aDocThing.hide("blind", undefined, undefined, function() {
                     aDocThing.remove();
                   });
  },

  formatBrief: function(aThing) {
    var link = $("<a></a>")
               .text(aThing.name)
               .data("what", aThing)
               .addClass(aThing.type + "-name")
               .click(this.showClick);
    var summary = this.formatSummary(aThing);
    var tr = $("<tr></tr>");
    tr.append($("<td></td>").append(link));
    tr.append($("<td></td>").append(summary));
    return tr;
  },
  _compareNames: function (a, b) {
    return a.name.localeCompare(b.name);
  },
  formatBriefsWithHeading: function(aHeading, aThings) {
    if (!aThings.length)
      return $([]);

    aThings.sort(this._compareNames);

    var nodes = $("<h3></h3>").text(aHeading);

    var tableNode = $("<table></table>");
    nodes = nodes.add(tableNode);
    for (var iThing = 0; iThing < aThings.length; iThing++) {
      tableNode.append(this.formatBrief(aThings[iThing]));
    }

    return nodes;
  },

  /**
   * Create a docthing widget for a given thing.
   */
  _makeThingNode: function UI__makeThingNode(aThing) {
    var node = $("<div></div>")
               .attr("id", aThing.type + "-" + aThing.fullName)
               .addClass("docthing");
    var toolbar = $("<div></div>")
      .addClass("docthing-toolbar")
      .appendTo(node);

    $("<h2></h2>")
      .text(aThing.fullName)
      .addClass(aThing.type + "-name")
      .appendTo(node);


    this._makeToolbarWidgets(toolbar, aThing);

    return node;
  },


  _compareWidgetsByPositionAndName:
      function UI__compareWidgetsByPositionAndName(a, b) {
    // use the icon as a proxy for name for now
    if (a.desiredPosition == b.desiredPosition)
      return a.icon.localeCompare(b.icon);
    return a.desiredPosition - b.desiredPosition;
  },
  /**
   * Construct the toolbar widgets for a given thing.
   */
  _makeToolbarWidgets: function(aToolbarNode, aThing) {
    var widget;
    var eligible = [];
    for each (widget in Widgets.itemToolbar) {
      if (widget.appliesTo === true ||
          aThing.type in widget.appliesTo)
        eligible.push(widget);
    }

    eligible.sort(this._compareWidgetsByPositionAndName);

    for (var iWidget = 0; iWidget < eligible.length; iWidget++) {
      widget = eligible[iWidget];

      this._makeToolbarWidget(widget, aThing).appendTo(aToolbarNode);
    }
  },
  _makeToolbarWidget: function(aWidget, aThing) {
    return $("<span></span>")
      .addClass("ui-icon")
      .addClass("ui-icon-" + aWidget.icon)
      .click(function() {
               var jThis = $(this);
               aWidget.onClick(jThis.closest(".docthing"),
                               jThis.data("what"));
             });
  },

  /**
   * @return a jQuery wrapped DOM node
   */
  formatSummary: function UI_formatSummary(aThing) {
    if (aThing.summaryStream)
      return this.formatTextStream(aThing.summaryStream);
    if (!aThing.docStream)
      return $("<span class='undocumented'></span>")
        .text("Not documented");

    var stream = aThing.docStream[0].stream;
    if (aThing.docStream[0].type == "tag") {
      stream = stream.concat();
      stream.unshift(aThing.docStream[0].tag + " ");
    }
    return $("<span></span>").append(this.formatTextStream(stream, true));
  },

  /**
   * Given a text-stream (usually found in a "stream" attribute), render it to
   *  a list of text nodes.
   *
   * @return a jQuery wrappet set of nodes.
   */
  formatTextStream: function UI_formatTextStream(aTextStream, aMakeSummary) {
    if (!aTextStream)
      return $("<span class='nodoc'>No stream?</span>");

    var nodes = $([]);

    for (var iStream = 0; iStream < aTextStream.length; iStream++) {
      var hunk = aTextStream[iStream];
      if (typeof(hunk) == "string") {
        if (aMakeSummary && hunk.indexOf(".") != -1)
          hunk = hunk.substring(0, hunk.indexOf(".") + 1);
        nodes = nodes.add($("<span></span>").text(hunk));
        if (aMakeSummary && hunk.lastIndexOf(".") != -1)
          return nodes;
      }
      else {
        if (hunk.type == "reference") {
          nodes = nodes.add($("<a></a>")
                    .text(hunk.reference)
                    .data("what", hunk)
                    .click(UI.showClick));
        }
      }
    }

    return nodes;
  },

  /**
   * Given a docStream (usually found in a "docStream" attribute), render it to
   *  a list of p/dl nodes.
   */
  formatDocStream: function UI_formatDocStream(aStream) {
    if (!aStream)
      return $("<span class='nodoc'>Not documented</span>");

    var nodes = $([]);

    var dlNode;
    for (var iStream = 0; iStream < aStream.length; iStream++) {
      var block = aStream[iStream];
      if (block.type == "para") {
        nodes = nodes.add($("<p></p>").append(this.formatTextStream(block.stream)));
      }
      else if (block.type == "tag") {
        if (!dlNode) {
          dlNode = $("<dl></dl>");
          nodes = nodes.add(dlNode);
        }
        $("<dt></dt>")
          .text(block.tag)
          .appendTo(dlNode);
        // We will need to specialize on fancy tags in the future, although
        //  they might not have a type of "tag" to help distinguish them.
        $("<dd></dd>")
          .append(this.formatTextStream(block.stream))
          .appendTo(dlNode);
      }
    }
    return nodes;
  },
};

var UIUtils = {
  /**
   * Given a set of items with labels containing paths, build a simplified tree
   *  structure.
   *
   * The general idea where '' indicates a string and "" a labeled object:
   * - ["foo.js"] => ["foo.js"]
   * - ["a/bar.js", "a/baz.js"] => ['a', "bar.js", "baz.js"]
   * - ["foo.js", "a/bar.js", "a/baz.js"] =>
   *     ['', ['a', "bar.js", "baz.js"], "foo.js"]
   *
   * @return A simplified tree in the form of nested arrays.  The first element
   *     in each array is always the {String} label for that sub-tree.
   */
  treeifyPaths: function(aItems, aLabelKey) {
    // in order to distinguish between file-ish nodes and nodes in our tree rep,
    //  we assume that that labelKey is never a path component.  Lazy but
    //  fine for our purposes.
    var fullTree = {};

    function placeInTree(aNode, aPathParts, aWhat) {
      if (aPathParts.length == 1)
        aNode[aPathParts[0]] = aWhat;
      else {
        var part = aPathParts.shift();
        var childNode;
        if (part in aNode)
          childNode = aNode[part];
        else
          childNode = aNode[part] = {};
        placeInTree(childNode, aPathParts, aWhat);
      }
    }

    var iItem, item;
    for (iItem = 0; iItem < aItems.length; iItem++) {
      item = aItems[iItem];
      var pathParts = item[aLabelKey].split("/");
      placeInTree(fullTree, pathParts, item);
    }

    function labelComparator(a, b) {
      var sa, sb;
      if (typeof(a) == "string")
        sa = a;
      else if (a.length)
        sa = typeof(a[0]) == "string" ? a[0] : a[0][aLabelKey];
      else
        sa = a[aLabelKey];
      if (typeof(b) == "string")
        sb = b;
      else if (b.length)
        sb = typeof(b[0]) == "string" ? b[0] : b[0][aLabelKey];
      else
        sb = b[aLabelKey];
      return sa.localeCompare(sb);
    }
    function makeSimpleTree(aNode, aLabelSoFar) {
      var labelCount = 0, treeCount = 0;
      // count labeled nodes and tree nodes
      var key, child;
      for (key in aNode) {
        child = aNode[key];
        if (aLabelKey in child)
          labelCount++;
        else
          treeCount++;
      }
      // collapse case
      if ((labelCount + treeCount) == 1) {
        aLabelSoFar += key;
        if (treeCount)
          return makeSimpleTree(child, aLabelSoFar + "/");
        child.label = aLabelSoFar;
        return [child];
      }

      // expand case...
      var out = [];
      for (key in aNode) {
        child = aNode[key];
        // check if it's a file/leaf node
        if (aLabelKey in child) {
          child[aLabelKey] = key;
          out.push(child);
        }
        else
          out.push(makeSimpleTree(child, key + "/"));
      }
      out.sort(labelComparator);
      out.unshift(aLabelSoFar);
      return out;
    }

    return makeSimpleTree(fullTree, "");
  }
};