<script lang="ts" module>
  /**
   * PostForm — „Aktuelle Informationen" (news) create / edit form.
   *
   * Title + body are required; excerpt and the single cover image are
   * optional. The cover image is held in local state (the shared
   * `ImageUploader` is presentation-only) and persisted with the post
   * on save, so no separate upload round-trip is needed.
   */
  export type PostFormValues = {
    title: string
    excerpt?: string
    body: string
    coverImage?: { mime: string; data: string } | null
    published: boolean
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import ImageUploader from '$lib/components/ui/ImageUploader.svelte'
  import {
    useFormValidation,
    validationClasses
  } from '$lib/utils/form-validation.svelte'
  import { maxLength, minLength, object, pipe, string, trim } from 'valibot'

  type Post = {
    title?: string | null
    excerpt?: string | null
    body?: string | null
    coverImage?: { mime: string; data: string } | null
    published?: boolean | null
  }

  type Props = {
    initial?: Post
    onSave: (values: PostFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  const init = untrack(() => ({ ...initial }))

  let title = $state(init.title ?? '')
  let excerpt = $state(init.excerpt ?? '')
  let body = $state(init.body ?? '')
  let coverImage = $state<{ mime: string; data: string } | null>(
    init.coverImage ?? null
  )
  let published = $state(Boolean(init.published))

  let errorMsg = $state<string | null>(null)

  const postSchema = object({
    title: pipe(
      string('Bitte einen Titel eingeben.'),
      trim(),
      minLength(1, 'Bitte einen Titel eingeben.'),
      maxLength(200, 'Der Titel darf maximal 200 Zeichen lang sein.')
    ),
    body: pipe(
      string('Bitte einen Inhalt eingeben.'),
      minLength(1, 'Bitte einen Inhalt eingeben.'),
      maxLength(50000, 'Der Inhalt darf maximal 50.000 Zeichen lang sein.')
    )
  })

  const fv = useFormValidation(postSchema, () => ({ title, body }))
  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const u = (v: string) => (v.trim() === '' ? undefined : v.trim())

  const coverImages = $derived(
    coverImage ? [{ id: 'cover', dataUrl: coverImage.data }] : []
  )

  const onUploadCover = async (file: { mime: string; dataUrl: string }) => {
    coverImage = { mime: file.mime, data: file.dataUrl }
    formDirty.set(true)
  }
  const onDeleteCover = async () => {
    coverImage = null
    formDirty.set(true)
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) {
      errorMsg =
        (Object.values(fv.errors).find((v) => v != null) as string | null) ??
        'Bitte prüfen Sie Ihre Eingabe.'
      return
    }
    errorMsg = null
    formDirty.clear()
    await onSave({
      title: title.trim(),
      excerpt: u(excerpt),
      body: body.trim(),
      coverImage,
      published
    })
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
      >{/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Beitrag</legend>
      <div class="grid grid-cols-1 gap-3">
        <FormField
          label="Titel"
          required
          error={wasTouched('title') ? err('title') : null}
        >
          <input
            class={validationClasses(err('title'), wasTouched('title'))}
            maxlength="200"
            bind:value={title}
            onblur={() => fv.markTouched('title')}
          />
        </FormField>
        <FormField label="Teaser (kurze Vorschau)">
          <textarea
            class="textarea textarea-bordered min-h-16 w-full"
            maxlength="500"
            placeholder="Kurzer Anrisstext für die Übersicht auf der Website"
            bind:value={excerpt}
          ></textarea>
        </FormField>
        <FormField
          label="Inhalt"
          required
          error={wasTouched('body') ? err('body') : null}
        >
          <textarea
            class="textarea textarea-bordered min-h-60 w-full {err('body') &&
            wasTouched('body')
              ? 'textarea-error'
              : ''}"
            maxlength="50000"
            bind:value={body}
            onblur={() => fv.markTouched('body')}
          ></textarea>
        </FormField>
      </div>
    </fieldset>

    <ImageUploader
      images={coverImages}
      title="Titelbild"
      hint="Optional. PNG, JPEG oder WebP, max. 5 MB."
      single
      allowSetMain={false}
      maxBytes={5 * 1024 * 1024}
      onUpload={onUploadCover}
      onDelete={onDeleteCover}
    />

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Veröffentlichung</legend>
      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          class="checkbox checkbox-primary"
          bind:checked={published}
        />
        <span class="flex flex-col">
          <span>Veröffentlicht</span>
          <span class="text-base-content/60 text-xs">
            Nur veröffentlichte Beiträge erscheinen auf der Website. Entwürfe
            bleiben intern.
          </span>
        </span>
      </label>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      {#if onCancel}
        <button
          type="button"
          class="btn btn-ghost"
          onclick={onCancel}
          disabled={busy.active}>Abbrechen</button
        >
      {/if}
      <button
        type="submit"
        class="btn btn-primary"
        disabled={busy.active || !fv.valid}
      >
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
