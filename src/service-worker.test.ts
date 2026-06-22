import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * Service-worker unit tests.
 *
 * The SW is a side-effecting module: importing it registers
 * `install` / `activate` / `fetch` handlers against the
 * `ServiceWorkerGlobalScope`. To exercise it under vitest we mock
 * the `$service-worker` virtual module, stub a minimal
 * `self`, `caches` and `fetch`, then re-import the module fresh
 * for each test and invoke the captured handlers.
 */

vi.mock('$service-worker', () => ({
  build: ['/_app/immutable/chunk-a.js', '/_app/immutable/chunk-b.js'],
  files: ['/favicon.ico', '/icon.png'],
  version: 'test-version-1',
  prerendered: []
}))

type Handler = (event: ExtendableEvent | FetchEvent) => void

interface InstallEventLike {
  waitUntil: (p: Promise<unknown>) => void
}

interface FetchEventLike {
  request: Request
  respondWith: (p: Promise<Response>) => void
}

/** In-memory Cache stub that records `put` and `addAll` calls. */
function makeCacheStub() {
  const store = new Map<string, Response>()
  return {
    store,
    addAll: vi.fn(async (urls: string[]) => {
      for (const u of urls) store.set(u, new Response('asset', { status: 200 }))
    }),
    add: vi.fn(async (req: Request | string) => {
      const key = typeof req === 'string' ? req : req.url
      store.set(key, new Response('start', { status: 200 }))
    }),
    put: vi.fn(async (req: Request, res: Response) => {
      store.set(req.url, res)
    }),
    match: vi.fn(async (req: Request | string) => {
      const key = typeof req === 'string' ? req : req.url
      // Support matching against same-origin pathnames as full URLs.
      if (store.has(key)) return store.get(key)
      try {
        const u = new URL(key, 'http://localhost')
        return store.get(u.pathname)
      } catch {
        return undefined
      }
    })
  }
}

/** Sets up the global `self`, `caches`, and event capturing. */
async function setup({
  preExistingCaches = ['old-cache-v0']
}: { preExistingCaches?: string[] } = {}) {
  const cache = makeCacheStub()
  const cachesByName = new Map<string, ReturnType<typeof makeCacheStub>>()
  for (const k of preExistingCaches) cachesByName.set(k, makeCacheStub())

  const cachesStub = {
    open: vi.fn(async (name: string) => {
      let c = cachesByName.get(name)
      if (!c) {
        c = cache
        cachesByName.set(name, c)
      }
      return c
    }),
    keys: vi.fn(async () => Array.from(cachesByName.keys())),
    delete: vi.fn(async (name: string) => cachesByName.delete(name)),
    match: vi.fn(async () => undefined)
  }

  const handlers: Record<string, Handler> = {}
  const skipWaiting = vi.fn(async () => {})
  const claim = vi.fn(async () => {})

  const selfStub = {
    addEventListener: (type: string, h: Handler) => {
      handlers[type] = h
    },
    skipWaiting,
    clients: { claim },
    location: { origin: 'http://localhost' }
  }

  vi.stubGlobal('self', selfStub)
  vi.stubGlobal('caches', cachesStub)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('network', { status: 200 }))
  )

  // Fresh module each call so the event listeners attach to the
  // current `self` stub.
  vi.resetModules()
  await import('./service-worker.ts')

  return { handlers, cache, cachesByName, cachesStub, skipWaiting, claim }
}

/** Drives a handler with a fake event and returns the awaited promise. */
async function runInstall(handler: Handler) {
  let waited: Promise<unknown> = Promise.resolve()
  const event: InstallEventLike = {
    waitUntil: (p) => {
      waited = p
    }
  }
  handler(event as unknown as ExtendableEvent)
  await waited
}

async function runFetch(handler: Handler, request: Request) {
  let responded: Promise<Response> | undefined
  const event: FetchEventLike = {
    request,
    respondWith: (p) => {
      responded = p
    }
  }
  handler(event as unknown as FetchEvent)
  return responded
}

describe('service-worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('caches build + static files on install', async () => {
    const { handlers, cache } = await setup()
    await runInstall(handlers.install)

    expect(cache.addAll).toHaveBeenCalledTimes(1)
    const cached = cache.addAll.mock.calls[0][0] as string[]
    expect(cached).toEqual(
      expect.arrayContaining([
        '/_app/immutable/chunk-a.js',
        '/_app/immutable/chunk-b.js',
        '/favicon.ico',
        '/icon.png'
      ])
    )
    // Start URL is also seeded so the offline navigation fallback works.
    expect(cache.add).toHaveBeenCalled()
  })

  it('calls skipWaiting after install', async () => {
    const { handlers, skipWaiting } = await setup()
    await runInstall(handlers.install)
    expect(skipWaiting).toHaveBeenCalled()
  })

  it('cleans up old caches on activate', async () => {
    const { handlers, cachesStub, cachesByName, claim } = await setup({
      preExistingCaches: ['old-cache-v0', 'older-cache']
    })
    await runInstall(handlers.install)
    // After install the new versioned cache exists alongside the old
    // ones. Activate should delete every cache that isn't ours.
    expect(Array.from(cachesByName.keys())).toEqual(
      expect.arrayContaining([
        'old-cache-v0',
        'older-cache',
        'twincars-cache-test-version-1'
      ])
    )

    await runInstall(handlers.activate)

    expect(cachesStub.delete).toHaveBeenCalledWith('old-cache-v0')
    expect(cachesStub.delete).toHaveBeenCalledWith('older-cache')
    expect(cachesStub.delete).not.toHaveBeenCalledWith(
      'twincars-cache-test-version-1'
    )
    expect(claim).toHaveBeenCalled()
  })

  it('fetch goes to the network first and caches the response', async () => {
    const { handlers, cache } = await setup()
    await runInstall(handlers.install)
    const req = new Request('http://localhost/data', { method: 'GET' })
    // Make fetch return a basic-typed response so the SW caches it.
    const networkRes = new Response('live', { status: 200 })
    Object.defineProperty(networkRes, 'type', { value: 'basic' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => networkRes)
    )

    const responded = await runFetch(handlers.fetch, req)
    const final = await responded
    expect(final?.status).toBe(200)
    expect(await final?.text()).toBe('live')
    expect(cache.put).toHaveBeenCalled()
  })

  it('fetch falls back to cache when the network throws', async () => {
    const { handlers, cache } = await setup()
    await runInstall(handlers.install)
    const url = 'http://localhost/_app/immutable/chunk-a.js'
    // Seed the cache with a known entry under the same URL.
    cache.store.set(
      url,
      new Response('cached chunk', { status: 200, headers: { etag: '1' } })
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    const responded = await runFetch(
      handlers.fetch,
      new Request(url, { method: 'GET' })
    )
    const final = await responded
    expect(await final?.text()).toBe('cached chunk')
  })

  it('fetch serves the cached start URL on a failed navigation', async () => {
    const { handlers, cache } = await setup()
    await runInstall(handlers.install)
    // Replace the start-URL entry with something identifiable.
    cache.store.set('/', new Response('shell', { status: 200 }))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    // The `navigate` request mode can't be set via the Request
    // constructor (it's only assigned by the browser when the user
    // navigates), so we hand-roll a minimal request-shaped object.
    const navRequest = {
      url: 'http://localhost/some/page',
      method: 'GET',
      mode: 'navigate' as RequestMode
    } as unknown as Request

    const responded = await runFetch(handlers.fetch, navRequest)
    const final = await responded
    expect(await final?.text()).toBe('shell')
  })

  it('skips non-GET requests', async () => {
    const { handlers } = await setup()
    await runInstall(handlers.install)
    const req = new Request('http://localhost/api', { method: 'POST' })
    const responded = await runFetch(handlers.fetch, req)
    // respondWith was never called → handler returned undefined.
    expect(responded).toBeUndefined()
  })

  it('skips cross-origin requests', async () => {
    const { handlers } = await setup()
    await runInstall(handlers.install)
    const req = new Request('https://example.com/style.css', { method: 'GET' })
    const responded = await runFetch(handlers.fetch, req)
    expect(responded).toBeUndefined()
  })
})
