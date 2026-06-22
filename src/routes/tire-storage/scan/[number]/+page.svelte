<script lang="ts">
  /**
   * QR deep-link target. The tire-storage label encodes
   * `{origin}/tire-storage/scan/<storageNumber>`; scanning it with a
   * phone lands here, we resolve the number to its entry id and forward
   * to the detail page. An unknown number throws 404 (handled by the
   * root `+error.svelte`).
   */
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { resolveTireStorageByNumberRemote } from '../../tire-storage.remote'

  const number = untrack(() => page.params.number!)
  const { id } = await resolveTireStorageByNumberRemote({ number })

  // Forward to the real detail page; replaceState so the browser back
  // button skips this redirect hop.
  $effect(() => {
    goto(`/tire-storage/${id}`, { replaceState: true })
  })
</script>

<div class="text-base-content/60 p-6 text-sm">
  Einlagerung <span class="font-mono">{number}</span> wird geöffnet …
</div>
