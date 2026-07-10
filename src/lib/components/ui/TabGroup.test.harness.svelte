<script lang="ts">
  import TabGroup, { type TabItem } from './TabGroup.svelte'

  type Props = {
    name: string
    tabs: TabItem[]
    active?: string
    urlParam?: string | null
    contentClass?: string
  }

  const {
    name,
    tabs,
    active = undefined,
    urlParam = 'tab',
    contentClass = 'p-4'
  }: Props = $props()
</script>

<!--
  Test harness for TabGroup — Testing-Library can't pass a Snippet
  directly, so we wrap TabGroup and render a marker panel per tab.
-->
<TabGroup {name} {tabs} {active} {urlParam} {contentClass}>
  {#snippet content(id)}
    <div data-testid={`panel-${id}`}>Panel {id}</div>
  {/snippet}
</TabGroup>
