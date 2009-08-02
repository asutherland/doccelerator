function(doc) {
  if (doc.file && doc.loc)
    emit([doc.file, doc.loc.line], null);
}
