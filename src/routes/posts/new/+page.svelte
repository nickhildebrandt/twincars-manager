<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import PostForm, { type PostFormValues } from '../PostForm.svelte'
  import { createPostRemote } from '../posts.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const handleSave = async (values: PostFormValues) => {
    try {
      const created = await busy.run(() => createPostRemote(values))
      // Saved — release the unsaved-changes guard before the goto
      // (§11: clear AFTER success, BEFORE navigating; the catch path
      // leaves the form dirty so cancel/navigation still warns).
      formDirty.clear()
      toast.success('Beitrag angelegt.')
      goto(`/posts/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Neuen Beitrag anlegen"
  subtitle="Aktuelle Information für die Website verfassen."
/>
<PostForm onSave={handleSave} onCancel={() => goto('/posts')} />
