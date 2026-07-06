<script lang="ts">
  import PositionsEditor, {
    blankPosition,
    type Position
  } from './PositionsEditor.svelte'

  /**
   * Test harness: owns the positions array as deep-reactive `$state`
   * and binds it — exactly how the offer and invoice create pages use
   * the editor.
   */
  type Props = { initial?: Position[]; descriptionPlaceholder?: string }

  let { initial = [blankPosition()], descriptionPlaceholder }: Props = $props()

  // svelte-ignore state_referenced_locally -- seeding once is the point
  let positions = $state<Position[]>(initial)
</script>

<PositionsEditor bind:positions {descriptionPlaceholder} />
