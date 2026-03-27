export interface User {
  name: string
  email: string
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('et_radar_token')
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('et_radar_user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setAuth(token: string, user: User): void {
  localStorage.setItem('et_radar_token', token)
  localStorage.setItem('et_radar_user', JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem('et_radar_token')
  localStorage.removeItem('et_radar_user')
  localStorage.removeItem('et_radar_guest')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function isGuest(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('et_radar_guest') === 'true'
}
