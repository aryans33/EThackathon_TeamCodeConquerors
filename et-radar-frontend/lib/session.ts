export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = localStorage.getItem('et_radar_session')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('et_radar_session', id) }
  return id
}
