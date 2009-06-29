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

    // - Figure out the insertion point and its visibility.
    // We want to make sure that if the user clicks on something that they can
    //  see it.  Our current heuristic is that if they will not be able to see
    //  it, we inject it without animation and scroll to it.  If they can see
    //  it, we visually expand it using "blind".

    // Find out where it will be inserted
    var insertionY;
    if (aWhatClicked && aWhatClicked.length)
      insertionY = aWhatClicked.offset().top + aWhatClicked.height();
    else
      insertionY = 60;

    var docTop = $(window).scrollTop(), docBottom = docTop + $(window).height();
    // require some extra space so the thing can be somewhat visible
    var visible = (insertionY >= docTop + 60 && insertionY <= docBottom - 60);
    // figure out if the thing is huge and the blind effect is danger-prone
    var tooHuge = node.height() > $(window).height();

    // if the insertion point is visible hide it so we can show it
    if (visible && !tooHuge)
      node.hide();

    // insert it however
    if (aWhatClicked && aWhatClicked.length)
      aWhatClicked.after(node);
    else
      $("#body").prepend(node);

    // animate it however
    if (visible) {
      if (tooHuge)
        node.effect("highlight");
      else
        node.show("blind");
    }
    else {
      $.scrollTo(node, 400);
      node.effect("highlight", null, 500);
    }
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

  /**
   * Create a docthing widget for a given thing.
   */
  _makeThingNode: function UI__makeThingNode(aThing) {
    var node = $("<div></div>")
               .attr("id", aThing.type + "-" + aThing.fullName)
               .data("what", aThing)
               .addClass("docthing");
    var toolbar = $("<div></div>")
      .addClass("docthing-toolbar")
      .appendTo(node);

    var extraName = aThing.fullName.substring(
                      0, aThing.fullName.length - aThing.name.length);

    if (extraName) {
      $("<h2></h2>")
        .append($("<span></span>")
          .text(extraName)
          .addClass("extraname"))
        .append($("<span></span>")
          .text(aThing.name)
          .addClass(aThing.type + "-name"))
        .appendTo(node);
    }
    else {
      $("<h2></h2>")
        .text(aThing.fullName)
        .addClass(aThing.type + "-name")
        .appendTo(node);
    }

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

      if (iWidget)
        aToolbarNode.append("&nbsp;");
      this._makeToolbarWidget(widget, aThing).appendTo(aToolbarNode);
    }
  },
  _makeToolbarWidget: function(aWidget, aThing) {
    var widget = $("<span></span>")
      .click(function() {
               var jDocThing = $(this).closest(".docthing");
               aWidget.onClick(jDocThing,
                               jDocThing.data("what"));
             });
    $("<span></span>")
      .addClass("inline-icon")
      .addClass("ui-icon-" + aWidget.icon)
      .appendTo(widget);
    $("<span></span>")
      .text(aWidget.label)
      .appendTo(widget);
    return widget;
  },

};

UI.format = {
  brief: function UI_format_brief(aThing) {
    var link = $("<a></a>")
               .text(aThing.name)
               .data("what", aThing)
               .addClass(aThing.type + "-name")
               .click(UI.showClick);
    var summary = this.summary(aThing);
    var tr = $("<tr></tr>");
    tr.append($("<td></td>").append(link));
    tr.append($("<td></td>").append(summary));
    return tr;
  },
  _compareNames: function (a, b) {
    return a.name.localeCompare(b.name);
  },
  briefsWithHeading:
      function UI_format_briefsWithHeading(aHeading, aThings, aCollapsed) {
    if (!aThings.length)
      return $([]);

    aThings.sort(this._compareNames);

    var nodes = $("<h3></h3>")
      .text(aHeading)
      .addClass("collapsable")
      .click(function() {
               $(this).toggleClass("collapsed").next().toggle();
             });

    var tableNode = $("<table></table>");
    nodes = nodes.add(tableNode);
    for (var iThing = 0; iThing < aThings.length; iThing++) {
      tableNode.append(this.brief(aThings[iThing]));
    }

    return nodes;
  },

  /**
   * @return a jQuery wrapped DOM node
   */
  summary: function UI_format_summary(aThing) {
    if (aThing.summaryStream)
      return this.textStream(aThing.summaryStream);
    if (!aThing.docStream)
      return $("<span class='undocumented'></span>")
        .text("Not documented");

    var stream = aThing.docStream[0].stream;
    if (aThing.docStream[0].type == "tag") {
      stream = aThing.docStream[0].text;
      stream.unshift(aThing.docStream[0].tag + " ");
    }
    return $("<span></span>").append(this.textStream(stream, true));
  },

  /**
   * Given a text-stream (usually found in a "stream" attribute), render it to
   *  a list of text nodes.
   *
   * @return a jQuery wrappet set of nodes.
   */
  textStream: function UI_format_textStream(aTextStream, aMakeSummary) {
    if (!aTextStream)
      return $("<span class='nodoc'>No stream?</span>");

    var nodes = $([]);

    for (var iStream = 0; iStream < aTextStream.length; iStream++) {
      var hunk = aTextStream[iStream];
      if (typeof(hunk) == "string") {
        var foundTerminus = false, periodPoint;
        if (aMakeSummary && ((periodPoint = hunk.indexOf(".")) != -1)) {
          // let parens and quotes close out
          var nextChar = hunk[periodPoint + 1];
          if (nextChar == ")" || nextChar == '"')
            periodPoint++;
          hunk = hunk.substring(0, periodPoint + 1);
        }
        nodes = nodes.add($("<span></span>").text(hunk));
        if (foundTerminus)
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
  docStream: function UI_format_docStream(aStream) {
    if (!aStream)
      return $("<span class='nodoc'>Not documented</span>");

    var nodes = $([]);

    var ulNode;
    for (var iStream = 0; iStream < aStream.length; iStream++) {
      var block = aStream[iStream];
      if (block.type == "para") {
        nodes = nodes.add($("<p></p>").append(this.textStream(block.stream)));
        ulNode = null;
      }
      else if (block.type == "bullet") {
        if (!ulNode) {
          ulNode = $("<ul></ul>");
          nodes = nodes.add(ulNode);
        }
        $("<li></li>")
          .append(this.textStream(block.stream))
          .appendTo(ulNode);
      }
    }
    return nodes;
  },

  /**
   * Given a thing, format its parameters, returning a jQuery collection of
   *  nodes suitable for appending to a parent node.
   */
  paramsWithHeading: function UI_format_paramsWithHeading(aThing) {
    var nodes = $("<h3></h3>")
      .text(_("Parameters"));
    var tableNode = $("<table></table>");
    nodes = nodes.add(tableNode);

    for (var iParam = 0; iParam < aThing.params.length; iParam++) {
      var param = aThing.params[iParam];
      var tr = $("<tr></tr>")
        .appendTo(tableNode);
      $("<td></td>")
        .text(param.name)
        .addClass("param-name")
        .appendTo(tr);
      $("<td></td>")
        .text(param.type || "")
        .appendTo(tr);
      $("<td></td>")
        .append(this.textStream(param.stream))
        .appendTo(tr);
    }

    return nodes;
  },

  /**
   * Given a thing, format its return value, returning a jQuery collection of
   *  nodes suitable for appending to a parent node.
   */
  returnWithHeading: function UI_format_paramsWithHeading(aThing) {
    var nodes = $("<h3></h3>")
      .text(_("Returns"));
    var streamNode = $("<div></div>")
      .append(this.textStream(aThing.returns.stream));
    return nodes.add(streamNode);
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