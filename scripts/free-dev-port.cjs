'use strict';

/**
 * Frees PORT (default 3000) before `nest start --watch` so restarts do not hit EADDRINUSE
 * when a previous listener is still bound.
 */
const killPort = require('kill-port');

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

killPort(port)
  .catch(() => {
    /* nothing listening or cannot kill — continue */
  })
  .finally(() => {
    process.exit(0);
  });
