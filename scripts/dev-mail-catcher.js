#!/usr/bin/env node
/**
 * Tiny dev-only SMTP catcher. Listens on `127.0.0.1:1025` and answers
 * just enough of the SMTP protocol that nodemailer's STARTTLS-disabled
 * default flow succeeds. Every captured message is written as a
 * timestamped `.eml` file under `tmp/mail/` so the developer can open
 * them with any mail client (Thunderbird, mutt, etc.) or just `cat`.
 *
 * Run alongside the dev server:
 *
 *   node scripts/dev-mail-catcher.js
 *
 * Then point `smtp_settings` at:
 *   host=127.0.0.1   port=1025   secure=none   from=any@example.com
 *
 * Pure stdlib — no extra dependency to install.
 */

import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

const HOST = process.env.MAIL_CATCHER_HOST ?? '127.0.0.1'
const PORT = Number(process.env.MAIL_CATCHER_PORT ?? 1025)
const OUT_DIR = path.resolve(
  process.env.MAIL_CATCHER_DIR ?? path.join(process.cwd(), 'tmp', 'mail')
)
fs.mkdirSync(OUT_DIR, { recursive: true })

let counter = 0

const handleConn = (socket) => {
  let inData = false
  let raw = ''
  let buffer = ''

  const send = (line) => socket.write(line + '\r\n')

  send('220 dev-mail-catcher.local ESMTP ready')

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf-8')
    while (true) {
      if (inData) {
        const idx = buffer.indexOf('\r\n.\r\n')
        if (idx < 0) return
        raw += buffer.slice(0, idx)
        buffer = buffer.slice(idx + 5)
        inData = false
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = path.join(OUT_DIR, `${ts}-${++counter}.eml`)
        fs.writeFileSync(filename, raw, 'utf-8')
        const sub = /^Subject: ([^\r\n]+)/m.exec(raw)?.[1] ?? '(no subject)'
        const to = /^To: ([^\r\n]+)/m.exec(raw)?.[1] ?? '?'
        console.log(`✉  ${filename}  →  ${to}  ::  ${sub}`)
        send('250 OK queued')
        raw = ''
        continue
      }
      const eol = buffer.indexOf('\r\n')
      if (eol < 0) return
      const line = buffer.slice(0, eol)
      buffer = buffer.slice(eol + 2)
      const cmd = line.split(' ')[0].toUpperCase()
      switch (cmd) {
        case 'EHLO':
        case 'HELO':
          send('250-dev-mail-catcher')
          send('250 SIZE 26214400')
          break
        case 'MAIL':
        case 'RCPT':
          send('250 OK')
          break
        case 'DATA':
          send('354 End data with <CR><LF>.<CR><LF>')
          inData = true
          raw = ''
          break
        case 'RSET':
          send('250 OK')
          break
        case 'NOOP':
          send('250 OK')
          break
        case 'QUIT':
          send('221 Bye')
          socket.end()
          return
        default:
          send('250 OK')
      }
    }
  })
  socket.on('error', () => {})
}

net
  .createServer(handleConn)
  .listen(PORT, HOST, () =>
    console.log(
      `dev-mail-catcher listening on ${HOST}:${PORT}, files in ${OUT_DIR}`
    )
  )
