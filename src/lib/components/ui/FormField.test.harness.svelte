<script lang="ts">
  import FormField from './FormField.svelte'

  type Props = {
    label: string
    required?: boolean
    error?: string | null
    hint?: string
    colSpan?: string
  }

  const {
    label,
    required = false,
    error = null,
    hint,
    colSpan
  }: Props = $props()
</script>

<!--
  Test harness for FormField — Testing-Library can't pass a Snippet
  directly, so we wrap FormField and provide a tiny `<input>` child.
-->
<FormField {label} {required} {error} {hint} {colSpan}>
  <input class="input input-bordered w-full" type="text" />
</FormField>
