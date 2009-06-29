function (doc) {
  if (doc.fullName)
    emit(doc.fullName, true);
  if (doc.name && doc.name != doc.fullName)
    emit(doc.name, false);
}