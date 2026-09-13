// Die Plandateien unter docs/rewrite/ werden bewusst nicht formatiert: sie
// enthalten maschinell erzeugte Tabellen mit sehr breiten Zellen (Inventar und
// Befunde), die ein Formatierer durch Spaltenausrichtung unbrauchbar
// aufblähen würde. `true` ist ein Befehl, der nichts tut und erfolgreich endet;
// lint-staged verlangt eine nicht-leere Konfiguration.
export default { '*': 'true' }
