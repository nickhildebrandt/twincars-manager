#!/usr/bin/env node
// Container healthcheck: probe the local app on the port the runtime
// listens on (default 3000). Exit 0 on 2xx/3xx, 1 otherwise. Used by
// the Quadlet HealthCmd — slim images don't ship wget/curl.
const port = process.env.PORT || 3000
const url = `http://127.0.0.1:${port}/`
const ctrl = new AbortController()
const timer = setTimeout(() => ctrl.abort(), 3000)
fetch(url, { signal: ctrl.signal })
  .then((r) => {
    clearTimeout(timer)
    process.exit(r.status < 400 ? 0 : 1)
  })
  .catch(() => process.exit(1))
