var UI = {
  show: function UI_show(aThing, aWhatClicked) {
    var node = this._makeThingNode(aThing);

    console.log("Building node");

    node.append(this.formatDocStream(aThing.docStream));

    console.log("Node built");

    node.hide();
    if (aWhatClicked && aWhatClicked.length)
      aWhatClicked.after(node);
    else
      $("#body").prepend(node);
    node.show("blind");
  },
  _showClick: function UI__showClick(aEvent) {
    UI.show($(this).data("what"),
            $(aEvent.target).closest(".docthing"));
  },
  _showReferenceClick: function UI__showReferenceClick() {

  },

  formatBrief: function(aThing) {
    var link = $("<a></a>")
               .text(aThing.name)
               .data("what", aThing)
               .addClass(aThing.type + "-name")
               .click(this._showClick);
    var summary = this.formatSummary(aThing);
    var tr = $("<tr></tr>");
    tr.append($("<td></td>").append(link));
    tr.append($("<td></td>").append(summary));
    return tr;
  },
  formatBriefsWithHeading: function(aHeading, aThings) {
    if (!aThings.length)
      return $([]);

    var nodes = $("<h3></h3>").text(aHeading);

    var tableNode = $("<table></table>");
    nodes = nodes.add(tableNode);
    for (var iThing = 0; iThing < aThings.length; iThing++) {
      tableNode.append(this.formatBrief(aThings[iThing]));
    }

    return nodes;
  },

  _makeThingNode: function UI__makeThingNode(aThing) {
    var node = $("<div></div>")
               .attr("id", aThing.type + "-" + aThing.fullName)
               .addClass("docthing");
    node.append($("<h2></h2>")
                  .text(aThing.fullName)
                  .addClass(aThing.type + "-name"));
    return node;
  },
  _makeSyntheticThingNode: function UI__makeSyntheticThingNode(aType, aName, aData) {
    var node = $("<div></div>")
               .attr("id", aType + "-" + aName)
               .addClass("docthing");
    node.append($("<h2></h2>")
                  .text(aName)
                  .addClass(aType + "-name"));
    return node;
  },

  _filterDocsByType: function UI__filterDocsByType(aDocs, aType) {
    var filtered = [];

    for (var i = 0; i < aDocs.length; i++) {
      var doc = aDocs[i];
      if (doc.type == aType)
        filtered.push(doc);
    }

    return filtered;
  },

  /**
   * Show the file, providing top-level information about the file.
   */
  showFile: function UI_showFile(aFilename) {
    fldb.getFileDocs("interesting", aFilename, function(docs) {
                       UI._showFileGivenDocs(aFilename, docs);
                     });
  },
  _showFileGivenDocs: function UI__showFileGivenDocs(aFilename, aDocs) {
    var node = this._makeSyntheticThingNode("file", aFilename);
    node.append(this.formatBriefsWithHeading(
                  "Globals",
                  this._filterDocsByType(aDocs, "global")));
    node.append(this.formatBriefsWithHeading(
                  "Classes",
                  this._filterDocsByType(aDocs, "class")));
    node.append(this.formatBriefsWithHeading(
                  "Functions",
                  this._filterDocsByType(aDocs, "function")));
    node.hide();
    $("#body").prepend(node);
    node.show("blind");
  },

  /**
   * @return a jQuery wrapped DOM node
   */
  formatSummary: function UI_formatSummary(aThing) {
    if (aThing.summaryStream)
      return this.formatTextStream(aThing.summaryStream);
    if (!aThing.docStream)
      return $("<span class='nodoc'>Not documented</span>");

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
                    .click(this._showReferenceClick));
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
