// Minimal single-origin cookie jar. The suite always talks to one base URL,
// so domain/path matching is deliberately ignored; Secure is ignored too
// because the servers under test speak plain HTTP on localhost.

export class CookieJar {
  private cookies = new Map<string, string>()

  get(name: string): string | undefined {
    return this.cookies.get(name)
  }

  has(name: string): boolean {
    return this.cookies.has(name)
  }

  names(): string[] {
    return [...this.cookies.keys()]
  }

  /** Absorb every Set-Cookie of a response (deletions included). */
  store(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';')
      const eq = pair.indexOf('=')
      if (eq <= 0) continue
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      let expired = false
      for (const attr of attrs) {
        const [k, v = ''] = attr.split('=')
        const key = k.trim().toLowerCase()
        if (key === 'max-age' && Number(v.trim()) <= 0) expired = true
        if (key === 'expires' && Date.parse(v.trim()) < Date.now()) expired = true
      }
      if (expired || value === '') this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }
}
