function (doc) {
  if (doc.parentName)
    emit(doc.parentName, null);
}