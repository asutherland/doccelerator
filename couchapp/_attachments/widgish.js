var Widgets = {
  sidebar: {
  },
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
                console.log("Failure retrieving list of files.");
              }
            });
  },
  _gotFiles: function(aData) {
    var jContent = $("<ul></ul>").appendTo($("#files .content").empty());
    var dis = this;
    $.each(aData.rows, function() {
      var filename = this.key;
      var node = $("<li></li>")
        .text(filename)
        .addClass("file-name")
        .click(dis._showFile);
      jContent.append(node);
    });
  },
  _showFile: function() {
    UI.showFile($(this).text());
  }
};

Widgets.body.fileSummary = {

};