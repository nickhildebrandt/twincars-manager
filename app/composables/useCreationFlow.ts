/**
 * Etwas anlegen, ohne zu verlieren, woran man gerade war.
 *
 * Der Fall: im Auftragsformular fehlt der Kunde. Der Nutzer öffnet die
 * Kundenauswahl, findet ihn nicht, drückt „Neu anlegen" — und landet auf der
 * vollständigen Kundenseite. Danach soll er zurück im Auftrag stehen, mit allem
 * was er schon getippt hatte, und der neue Kunde soll ausgewählt sein.
 *
 * Zwei Dinge, die der Vorgänger nicht gelöst hatte:
 *
 *   - **Der Entwurf enthält keine Binärdaten.** Er legte Fotos als Base64 mit
 *     ab, überschritt damit stumm das Speicherlimit und fiel auf reinen
 *     Arbeitsspeicher zurück. Ein Neuladen verlor dann alles, ohne Hinweis
 *     (B-111). Hier werden solche Felder gar nicht erst aufgenommen, und ein
 *     volles Speicherlimit ist eine Meldung, kein Schweigen.
 *   - **Ein Entwurf verfällt.** Nach einer Stunde ist er weg; ein Formular von
 *     gestern wiederherzustellen verwirrt mehr, als es hilft.
 */
import { safeRedirectTarget } from '#shared/redirect'

/** Wie lange ein Entwurf gilt. */
export const DRAFT_MAX_AGE_MS = 60 * 60 * 1000

/** Wie tief die Kette gehen darf. Verhindert ein Anlegen im Anlegen im Anlegen. */
export const MAX_DEPTH = 3

const STORAGE_KEY = 'tcm:creation-flow'

export type CreationDraft = {
  /** Wohin es zurückgeht. Immer ein Pfad dieser Anwendung. */
  returnTo: string
  /** Welche Art Datensatz angelegt wird — schützt vor einer Schleife. */
  entity: string
  /** Das Feld, in das der neue Datensatz eingesetzt wird. */
  field: string
  /** Der Formularstand. Ohne Dateien, ohne Bilder. */
  state: Record<string, unknown>
  createdAt: number
}

/** Felder, die niemals in einen Entwurf gehören. */
const BINARY_HINTS = ['photo', 'image', 'file', 'data', 'attachment', 'upload', 'bytes']

/**
 * Entfernt alles, was groß werden kann.
 *
 * Nicht aus Sparsamkeit: ein Entwurf mit einem eingebetteten Foto sprengt das
 * Speicherlimit des Browsers, und der Browser sagt das nicht freundlich.
 */
export function withoutBinaries(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    const suspicious = BINARY_HINTS.some(hint => key.toLowerCase().includes(hint))
    if (suspicious) continue
    if (value instanceof Blob || value instanceof ArrayBuffer) continue
    if (typeof value === 'string' && value.startsWith('data:')) continue
    out[key] = value
  }
  return out
}

/** Ob der Entwurf noch gilt. */
export const isFresh = (draft: CreationDraft, now = Date.now()): boolean =>
  now - draft.createdAt < DRAFT_MAX_AGE_MS

export function useCreationFlow() {
  const notify = useNotify()

  function read(): CreationDraft[] {
    if (!import.meta.client) return []
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const stack = JSON.parse(raw) as CreationDraft[]
      return Array.isArray(stack) ? stack.filter(draft => isFresh(draft)) : []
    }
    catch {
      // Beschädigt oder gesperrt. Ein Entwurf ist eine Bequemlichkeit, kein
      // Datenbestand — hier wird nichts gemeldet, nur neu angefangen.
      return []
    }
  }

  function write(stack: CreationDraft[]): boolean {
    if (!import.meta.client) return false
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack))
      return true
    }
    catch {
      notify.warning('Der Zwischenstand konnte nicht gesichert werden.', {
        description: 'Legen Sie den Datensatz an und kehren Sie zurück, ohne die Seite neu zu laden.',
      })
      return false
    }
  }

  /** Die Arten, die gerade schon in der Kette stecken — der Schleifenschutz. */
  const activeEntities = (): string[] => read().map(draft => draft.entity)

  /**
   * Legt den Entwurf ab und meldet, ob weitergegangen werden darf.
   *
   * Verweigert wird bei zu tiefer Schachtelung und bei einer Schleife: einen
   * Kunden aus einem Kunden anzulegen führt nirgendwohin.
   */
  function start(draft: Omit<CreationDraft, 'createdAt'>): boolean {
    const stack = read()

    if (stack.length >= MAX_DEPTH) {
      notify.warning('Zu viele angefangene Datensätze.', {
        description: 'Schließen Sie einen davon ab, bevor Sie den nächsten beginnen.',
      })
      return false
    }
    if (stack.some(entry => entry.entity === draft.entity)) {
      notify.warning(`Ein ${draft.entity} wird bereits angelegt.`, {
        description: 'Schließen Sie ihn erst ab.',
      })
      return false
    }

    return write([...stack, {
      ...draft,
      returnTo: safeRedirectTarget(draft.returnTo),
      state: withoutBinaries(draft.state),
      createdAt: Date.now(),
    }])
  }

  /** Der oberste Entwurf, ohne ihn zu entfernen. */
  const peek = (): CreationDraft | undefined => read().at(-1)

  /** Nimmt den obersten Entwurf herunter und gibt ihn zurück. */
  function pop(): CreationDraft | undefined {
    const stack = read()
    const draft = stack.pop()
    write(stack)
    return draft
  }

  /** Angelegt: zurück zum Formular, mit der neuen Kennung im Gepäck. */
  async function finish(createdId: string): Promise<void> {
    const draft = pop()
    if (!draft) {
      await navigateTo('/')
      return
    }
    await navigateTo({
      path: draft.returnTo.split('?')[0] ?? '/',
      query: { ...queryOf(draft.returnTo), [`neu_${draft.field}`]: createdId },
    })
  }

  /** Abgebrochen: zurück, ohne Auswahl. */
  async function cancel(): Promise<void> {
    const draft = pop()
    await navigateTo(draft?.returnTo ?? '/')
  }

  /** Alles vergessen, z. B. nach dem Speichern des Hauptformulars. */
  function clear(): void {
    if (!import.meta.client) return
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    }
    catch {
      // Nichts zu tun: gesperrter Speicher hat ohnehin nichts gespeichert.
    }
  }

  return { start, finish, cancel, peek, pop, clear, activeEntities, read }
}

/** Die Parameter eines Pfads als Objekt. */
function queryOf(path: string): Record<string, string> {
  const [, search] = path.split('?')
  if (!search) return {}
  return Object.fromEntries(new URLSearchParams(search))
}
