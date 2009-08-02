var mozilla191Repo = explodeRepo({
  url_base: '/xhr/hg/mozilla/mozilla-1.9.1/raw-file/tip/',
  repo_name: 'mozilla-1.9.1',
  dirs: [
    // -- XUL toolkit widgets
    {
      path: "toolkit/content/widgets/",
      chrome_path: "global/content/bindings/",
      subystem: "XUL",
      files: [
        "autocomplete.xml",
        "browser.xml",
        "button.xml",
        "checkbox.xml",
        "colorpicker.xml",
        "datetimepicker.xml",
        "dialog.xml",
        "editor.xml",
        "expander.xml",
        "filefield.xml",
        "findbar.xml",
        "general.xml",
        "groupbox.xml",
        "listbox.xml",
        "menulist.xml",
        "menu.xml",
        "notification.xml",
        "numberbox.xml",
        "optionsDialog.xml",
        "popup.xml",
        "preferences.xml",
        "progressmeter.xml",
        "radio.xml",
        "resizer.xml",
        "richlistbox.xml",
        "scale.xml",
        "scrollbar.xml",
        "scrollbox.xml",
        "spinbuttons.xml",
        "splitter.xml",
        "stringbundle.xml",
        "tabbox.xml",
        "textbox.xml",
        "text.xml",
        "toolbarbutton.xml",
        "toolbar.xml",
        "tree.xml",
        "videocontrols.xml",
        "wizards.xml"
      ]
    },
    {
      path: "js/src/xpconnect/loader/",
      module_path: "",
      files: [
        "XPCOMUtils.jsm"
      ]
    }
  ]
});

var thunderbirdRepo = explodeRepo({
  url_base: '/xhr/hg/mozilla/comm-central/raw-file/tip/',
         // 'http://hg.mozilla.org/comm-central/raw-file/tip/',
  repo_name: 'comm-central',
  dirs: [
    // -- mail/ modules
    {
      path: "mail/base/modules/",
      module_path: "",
      files: [
        "MailConsts.js",
        "MailUtils.js"
      ]
    },
    // -- mail/ chrome
    {
      path: "mail/base/content/",
      chrome_path: "messenger/content",
      subsystem: "folder display",
      files: [
        "folderDisplay.js",
        "messageDisplay.js"
      ],
    },
    {
      path: "mail/base/content/",
      chrome_path: "messenger/content",
      subsystem: "folder pane",
      files: [
        "folderPane.js",
      ],
    },
    {
      path: "mail/base/content/",
      chrome_path: "messenger/content",
      files: [
        // everything commented out below is preprocessed and a jerk
        //"aboutDialog.js",
        //"ABSearchDialog.js",
        "commandglue.js",
        //"contentAreaClick.js",
        "editContactOverlay.js",
        "FilterListDialog.js",
        //"hiddenWindow.js",
        "mail3PaneWindowCommands.js",
        //"mailCommands.js",
        "mailContextMenus.js",
        //"mailCore.js",
        //"mail-offline.js",
        "mailWindow.js",
        "mailWindowOverlay.js",
        "messageWindow.js",
        "msgHdrViewOverlay.js",
        "msgMail3PaneWindow.js",
        "msgViewNavigation.js",
        "newmailalert.js",
        "newTagDialog.js",
        //"nsContextMenu.js",
        "phishingDetector.js",
        "searchBar.js",
        "SearchDialog.js",
        "selectionsummaries.js",
        "specialTabs.js",
        "subscribe.js",
        //"systemIntegrationDialog.js",
        "threadPane.js",
        //"utilityOverlay.js",
        "widgetglue.js"
      ],
    },
    // -- mailnews/
    {
      path: "mailnews/base/src/",
      module_path: "",
      subsystem: "folder display",
      files: [
        "dbViewWrapper.js",
        "mailViewManager.js",
        "quickSearchManager.js",
        "searchSpec.js",
        "virtualFolderWrapper.js"
      ],
    },
    {
      path: "mailnews/base/util/",
      module_path: "",
      files: [
        "autoconfigUtils.jsm",
        "folderUtils.jsm",
        "iteratorUtils.jsm",
        "jsTreeSelection.js"
      ],
    },
    // -- gloda
    {
      path: "mailnews/db/gloda/modules/",
      module_path: "gloda",
      subsystem: "gloda",
      files: [
        "collection.js",
        "connotent.js",
        "databind.js",
        "datamodel.js",
        "datastore.js",
        "dbview.js",
        "everybody.js",
        "explattr.js",
        "fundattr.js",
        "gloda.js",
        "index_ab.js",
        "indexer.js",
        //"msg_search.js", // explodes on line 91-ish
        "noun_freetag.js",
        "noun_mimetype.js",
        "noun_tag.js",
        "public.js",
        "query.js",
        "utils.js"
      ]
    },
    {
      path: "mailnews/db/gloda/modules/",
      module_path: "gloda",
      subsystem: "logging",
      files: [
        "log4moz.js"
      ]
    },
    {
      path: "mailnews/db/gloda/modules/",
      module_path: "gloda",
      subsystem: "mime streaming",
      files: [
        "mimemsg.js"
      ]
    },
    {
      path: "mailnews/db/gloda/components/",
      components_path: "",
      subsystem: "mime streaming",
      files: [
        "jsmimeemitter.js"
      ]
    },
    // -- test stuff
    {
      path: "mailnews/test/resources/",
      subsystem: "test",
      files: [
        "asyncTestUtils.js",
        "mailTestUtils.js",
        "messageGenerator.js",
        "messageModifier.js",
        "searchTestUtils.js",
        "viewWrapperTestUtils.js"
      ]
    }
  ]
});
