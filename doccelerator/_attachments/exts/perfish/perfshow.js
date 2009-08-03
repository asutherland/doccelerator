Widgets.commands["ShowPerf"] = function() {
  var perfInfo = Widgets.body.topPerf.deserialize("perfish");
  UI.show(perfInfo);
};

Widgets.body.topPerf = {
  prepareToShow: function(aPerfInfo, aCallback) {
    // The documents for leaf functions we care about.  We do threshold
    aPerfInfo.leaf_funcs = [];
    aPerfInfo.branch_funcs = [];
    aPerfInfo.known_funcs = {};

    aPerfInfo.callback = aCallback;
    DBUtils.getDocs(aPerfInfo.db, "by_leaf_count", "perfish", {
                      descending: true, limit: 32
                    }, Widgets.body.topPerf._gotLeafCounts, aPerfInfo);
  },
  _gotLeafCounts: function(aDocs, aPerfInfo) {
    // arbitrary decimation threshold
    aPerfInfo.thresh_factor = 32;
    aPerfInfo.max_leaf_count = aDocs[0].leaf_samples;
    aPerfInfo.thresh_leaf_count = Math.floor(aPerfInfo.max_leaf_count /
                                             aPerfInfo.thresh_factor);

    // Walk until we find a doc that does not meet our threshold requirement.
    // For those that do meet the threshold, add them to leaf_funcs and
    //  known_funcs.
    for (var iDoc = 0; iDoc < aDocs.length; iDoc++) {
      var doc = aDocs[iDoc];

      if (doc.leaf_count < aPerfInfo.thresh_leaf_count)
        break;

      aPerfInfo.leaf_funcs.push(doc);
      aPerfInfo.known_funcs[doc.canonical_name] = doc;
    }

    DBUtils.getDocs(aPerfInfo.db, "by_leaf_count", "perfish", {
                      descending: true, limit: 64
                    }, Widgets.body.topPerf._gotBranchCounts, aPerfInfo);
  },
  _gotBranchCounts: function(aDocs, aPerfInfo) {
    // Similar deal to the leaf processing except:
    // - We ignore documents that we already know about as leaves.
    for (var iDoc = 0; iDoc < aDocs.length; iDoc++) {
      var doc = aDocs[iDoc];

      if (doc.leaf_count < aPerfInfo.thresh_leaf_count)
        break;

      if (doc.canonical_name in aPefInfo.known_funcs)
        continue;

      aPerfInfo.branch_funcs.push(doc);
      aPerfInfo.known_funcs[doc.canonical_name] = doc;
    }

    var callback = aPerfInfo.callback;
    aPerfInfo.callback = null;
    callback();
  },
  show: function(aNode, aPerfInfo, aDocs) {
    var graph = $("<div></div>")
      .addClass("graph-fd")
      .appendTo(aNode);
    var layout = aPerfInfo.layout = Widgets.widget.fdgraph.fab(graph[0]);

    var iDoc, doc, node;
    // map canonical paths to nodes
    var node_map = {};

    // -- build the nodes
    var maxCount = aPerfInfo.max_leaf_count;
    for (iDoc = 0; iDoc < aPerfInfo.leaf_funcs.length; iDoc++) {
      doc = aPerfInfo.leaf_funcs[iDoc];
      node = new DataGraphNode();
      var percentOfMax = doc.leaf_samples / maxCount;
      var lightness = 100 - (Math.floor(50 * percentOfMax));
      node.color = "hsl(0,100%," + lightness + "%)";
      node.radius = 10;
      layout.newDataGraphNode(node);

      node_map[doc.canonical_name] = node;
    }

    for (iDoc = 0; iDoc < aPerfInfo.branch_funcs.length; iDoc++) {
      doc = aPerfInfo.branch_funcs[iDoc];
      node = new DataGraphNode();
      var percentOfMax = doc.branch_samples / maxCount;
      var lightness = 100 - (Math.floor(50 * percentOfMax));
      node.color = "hsl(240,100%," + lightness + "%)";
      node.radius = 6;
      layout.newDataGraphNode(node);

      node_map[doc.canonical_name] = node;
    }

    // -- build the edges
    for (iDoc = 0; iDoc < aDocs.length; iDoc++) {
      doc = aDocs[iDoc];
      node = node_map[doc.canonical_name];

      for (var called_name in doc.called) {
        var call_count = doc.called[called_name];
        if (called_name in node_map) {
          var called_node = node_map[called_name];
          layout.newDataGraphEdge(node, called_node);
        }
      }
    }

    var buildTimer = new Timer(150);
    buildTimer.subscribe(layout);
    buildTimer.start();
  },
  serialize: function(aPerfInfo) {
    return aPerfInfo.db.name;
  },
  deserialize: function(aDBName) {
    var perfInfo = {
      name: _("Profile Samples"),
      fullName: _("Profile Samples"),
      db: $.couch.db(aDBName)
    };
    perfInfo.db.uri = urlbase + aDBName + "/";
    return perfInfo;
  }
};
