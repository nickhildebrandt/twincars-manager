// Conventional Commits, enforced in the commit-msg hook. semantic-release
// derives the version from these messages (./docs/rewrite/03-architektur.md §14.2).
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    // Work package or module, e.g. feat(customers) or chore(t-001).
    'scope-empty': [1, 'never'],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
