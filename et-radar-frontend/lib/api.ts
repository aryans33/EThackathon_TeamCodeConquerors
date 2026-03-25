import axios from 'axios'

const getDemoMode = () => {
  const envDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  if (typeof window !== 'undefined') {
    const ls = window.localStorage.getItem('et_radar_demo_mode')
    if (ls !== null) return ls === 'true'
  }
  return envDemo
}

export const DEMO_MODE = getDemoMode()

const api = axios.create({ 
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api' 
})

export default api
