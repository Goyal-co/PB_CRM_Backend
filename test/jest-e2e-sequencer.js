'use strict';

const Sequencer = require('@jest/test-sequencer').default;

/** Numeric prefix in `01-auth...` / `20-cleanup...` so e2e runs in dependency order. */
function orderKey(testPath) {
  const m = String(testPath).match(/[/\\](\d{2})-[^/\\]+$/);
  return m ? parseInt(m[1], 10) : 999;
}

class E2ESequencer extends Sequencer {
  sort(tests) {
    const copy = tests.slice();
    copy.sort((a, b) => orderKey(a.path) - orderKey(b.path));
    if (process.env.JEST_E2E_SEQUENCER_DEBUG === '1') {
      // eslint-disable-next-line no-console
      console.error(
        '[jest-e2e-sequencer]',
        copy.map((t) => t.path.replace(/\\/g, '/').split('/').pop()),
      );
    }
    return copy;
  }
}

module.exports = E2ESequencer;
