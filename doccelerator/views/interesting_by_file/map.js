function(doc) {
  if (doc.type == "global" ||
      doc.type == "class" ||
      doc.type == "function")
    emit(doc.file, null);
}