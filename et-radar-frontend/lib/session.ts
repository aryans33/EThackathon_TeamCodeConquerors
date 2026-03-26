export function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('et_radar_session')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('et_radar_session', id)
  }
  return id
}
