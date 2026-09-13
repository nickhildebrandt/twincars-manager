/**
 * Die Navigation, gefiltert auf das, was der Angemeldete sehen darf.
 *
 * Was gefiltert wird, steht in `shared/navigation.ts` — hier wird nur
 * angewandt, was der Server in `/api/me` beantwortet hat. Die Oberfläche
 * entscheidet nie selbst über Rechte.
 */
import { NAVIGATION, activeItem, titleFor, visibleNavigation } from '#shared/navigation'

export function useNavigation() {
  const { can } = useAuth()
  const route = useRoute()

  const groups = computed(() => visibleNavigation(can))
  const current = computed(() => activeItem(route.path, groups.value))

  return {
    /** Alle Gruppen mit mindestens einem sichtbaren Eintrag. */
    groups,
    /** Der Eintrag zur aktuellen Seite — der längste passende. */
    current,
    /** Beschriftung für Kopfzeile und Dokumenttitel. */
    title: computed(() => titleFor(route.path, groups.value)),
    /** Ungefiltert, für die Prüfung im Test. */
    all: NAVIGATION,
  }
}
