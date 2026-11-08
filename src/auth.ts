const SESSION_KEY = 'mana-session'

export function isAuthenticated(): boolean {
  return localStorage.getItem(SESSION_KEY) === '1'
}

/** In-app gate only — no credentials checked. */
export function login(): void {
  localStorage.setItem(SESSION_KEY, '1')
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
}
