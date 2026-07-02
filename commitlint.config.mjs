export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'chore', 'test']],
    'header-max-length': [2, 'always', 60],
  },
};
