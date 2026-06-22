<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * Canonical form-field layout used by every form in the app.
   *
   * Label sits **above** the input — the project standard. The caller
   * owns the actual `<input>` / `<select>` / `<textarea>` via the
   * `children` snippet so they keep full control over `bind:value`,
   * `type`, validation classes, etc. This component only handles the
   * label, required marker, error text and optional hint.
   *
   * @example
   * ```svelte
   * <FormField label="E-Mail" required error={errors.email} hint="optional">
   *   <input
   *     type="email"
   *     class={validationClasses(errors.email, touched.email)}
   *     bind:value={email}
   *     onblur={() => markTouched('email')}
   *   />
   * </FormField>
   * ```
   */
  type Props = {
    /** Visible label text. Rendered above the input. */
    label: string
    /** Adds the German required marker `*` after the label. */
    required?: boolean
    /** Curated German error message — shown in red below the input. */
    error?: string | null
    /** Light hint shown below the input only when there is no error. */
    hint?: string
    /** Width modifier on the wrapper. Defaults to full-width column. */
    colSpan?: string
    /** The actual input / select / textarea. */
    children: Snippet
  }

  const {
    label,
    required = false,
    error = null,
    hint,
    colSpan,
    children
  }: Props = $props()
</script>

<label class="flex w-full flex-col gap-1 {colSpan ?? ''}">
  <span class="label-text">
    {label}{required ? ' *' : ''}
  </span>
  {@render children()}
  {#if error}
    <span class="text-error text-sm">{error}</span>
  {:else if hint}
    <span class="text-base-content/60 text-xs">{hint}</span>
  {/if}
</label>
