function(doc) {
  if (doc.type == "comment") {
    emit(doc.commentOn, null);
  }
}
