// Visual configuration for the whole application. Component look, spacing and
// variants belong here — never into a <style> block or a pile of utility
// classes at the call site (../docs/rewrite/03-architektur.md §8.1).
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      secondary: 'slate',
      neutral: 'slate',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'red',
    },

    // The design language is flat, bordered and quiet: no shadows in the
    // content column, no custom rounding, one accent colour.
    card: {
      slots: {
        root: 'rounded-[var(--radius-box)] border border-default bg-default shadow-none',
      },
    },

    button: {
      defaultVariants: { color: 'primary', variant: 'solid', size: 'md' },
    },

    table: {
      slots: {
        tr: 'data-[selectable=true]:hover:bg-elevated data-[selectable=true]:cursor-pointer',
      },
    },
  },
})
