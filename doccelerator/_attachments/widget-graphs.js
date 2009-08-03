
/**
 * A force-directed graph.
 */
Widgets.widget.fdgraph = {
  fab: function(aDOMNode) {
    var layout = new ForceDirectedLayout(aDOMNode, true);
    return layout;
  }
};
