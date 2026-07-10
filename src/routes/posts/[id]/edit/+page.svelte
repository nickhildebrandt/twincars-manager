<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import PostForm, { type PostFormValues } from '../../PostForm.svelte'
  import { getPostRemote, updatePostRemote } from '../../posts.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const id = untrack(() => page.params.id!)

  const post = await getPostRemote({ id })

  const handleSave = async (values: PostFormValues) => {
    try {
      await busy.run(() => updatePostRemote({ id, values }))
      // Saved — release the unsaved-changes guard before the goto
      // (§11: clear AFTER success, BEFORE navigating; the catch path
      // leaves the form dirty so cancel/navigation still warns).
      formDirty.clear()
      toast.success('Beitrag gespeichert.')
      goto(`/posts/${id}`)
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Beitrag bearbeiten" subtitle={post.title} />

<PostForm
  initial={post}
  onSave={handleSave}
  onCancel={() => goto(`/posts/${post.id}`)}
/>
