function (doc) {
  if (doc.references) {
    for each (var value in doc.references) {
      emit(value, null);
    }
  }
}