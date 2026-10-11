import type { DashboardData } from './types'

/** What every view receives. Selection lives in the URL, so any view can be linked to. */
export interface ViewProps {
  data: DashboardData
  params: URLSearchParams
  setParams: (updates: Record<string, string | number | null | undefined>) => void
}
