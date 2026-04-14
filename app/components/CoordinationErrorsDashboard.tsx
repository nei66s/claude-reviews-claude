'use client'

import { useEffect, useState } from 'react'

interface WorkerError {
  id: string
  team_id: string
  worker_agent_id: string
  error_message: string
  error_category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  retry_count: number
  max_retries: number
  next_retry_at: string | null
  created_at: string
}

interface ErrorStats {
  total?: number
  bySeverity?: {
    low?: number
    medium?: number
    high?: number
    critical?: number
  }
  byCategory?: {
    low?: number
    medium?: number
    high?: number
  }
  pendingRetries?: number
}

/**
 * Errors Dashboard
 * Shows worker errors and retry status
 */
export function ErrorsDashboard({ teamId }: { teamId?: string }) {
  const [errors, setErrors] = useState<WorkerError[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ErrorStats>({})

  useEffect(() => {
    if (!teamId) return

    const fetchErrors = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/coordination/team/${teamId}/recent-errors`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        setErrors(data.errors || [])
        
        const statsResponse = await fetch(`/api/coordination/team/${teamId}/error-stats`)
        if (statsResponse.ok) {
          setStats(await statsResponse.json())
        }
      } catch (err) {
        console.error('Error fetching errors:', err)
        setErrors([])
      } finally {
        setLoading(false)
      }
    }

    fetchErrors()
  }, [teamId])

  const getSeverityColor = (severity: WorkerError['severity']) => {
    const colors: Record<WorkerError['severity'], string> = {
      low: 'bg-blue-700 text-blue-100',
      medium: 'bg-yellow-700 text-yellow-100',
      high: 'bg-orange-700 text-orange-100',
      critical: 'bg-red-700 text-red-100',
    }
    return colors[severity]
  }

  if (!teamId) return <div className="px-6 text-slate-400">Select a team to view errors</div>
  if (loading) return <div className="px-6 text-slate-300">⏳ Loading errors...</div>

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-6 text-white px-6 pt-6">Worker Errors</h2>

      {Object.keys(stats).length > 0 && (
        <div className="px-6 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-slate-500">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Total Errors</p>
              <p className="text-2xl font-bold text-white">{(stats.total as number) || 0}</p>
            </div>
            <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-blue-500">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Low</p>
              <p className="text-2xl font-bold text-blue-400">{(stats.byCategory?.low as number) || 0}</p>
            </div>
            <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-orange-500">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Medium+High</p>
              <p className="text-2xl font-bold text-orange-400">
                {((stats.byCategory?.medium as number) || 0) + ((stats.byCategory?.high as number) || 0)}
              </p>
            </div>
            <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-red-500">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Pending Retry</p>
              <p className="text-2xl font-bold text-red-400">{(stats.pendingRetries as number) || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 pb-6">
        {errors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">📭 No errors</p>
            <p className="text-slate-500 text-sm mt-1">Worker errors will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {errors.map((error) => (
              <div key={error.id} className="border border-slate-600 rounded-lg p-4 hover:border-slate-500 hover:bg-slate-700/50 transition">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-mono text-slate-300 mb-2">🔧 {error.worker_agent_id}</p>
                    <p className="text-sm text-slate-200 mt-1 mb-2">{error.error_message}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-xs px-2 py-1 bg-slate-900 text-slate-300 rounded">{error.error_category}</span>
                      <span className="text-xs px-2 py-1 bg-slate-900 text-slate-300 rounded">
                        {error.retry_count}/{error.max_retries} retries
                      </span>
                      {error.next_retry_at && <span className="text-xs px-2 py-1 bg-slate-900 text-yellow-300 rounded">⏰ Retry pending</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">🕐 {new Date(error.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${getSeverityColor(error.severity)}`}>
                    {error.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
