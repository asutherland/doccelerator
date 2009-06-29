function (doc) {
  if (doc.type == "class") {
    emit(doc.fullName, null);
    if (doc.name != doc.fullName)
      emit(doc.name, null);
  }
}