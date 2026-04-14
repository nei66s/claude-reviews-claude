'use client'

import { useEffect, useState } from 'react'

interface Workflow {
  id: string
  team_id: string
  conversation_id: string
  goal: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'
  created_at: string
}

/**
 * Workflows Dashboard
 * Shows workflow history and status
 */
export function WorkflowsDashboard({ teamId }: { teamId?: string }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!teamId) return

    const fetchWorkflows = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/coordination/team/${teamId}/workflows`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        setWorkflows(data.workflows || [])
        
        const statsResponse = await fetch(`/api/coordination/team/${teamId}/workflow-stats`)
        if (statsResponse.ok) {
          setStats(await statsResponse.json())
        }
      } catch (err) {
        console.error('Error fetching workflows:', err)
        setWorkflows([])
      } finally {
        setLoading(false)
      }
    }

    fetchWorkflows()
  }, [teamId])

  const getStatusIcon = (status: Workflow['status']) => {
    const icons: Record<Workflow['status'], string> = {
      pending: '⏳',
      in_progress: '⚙️',
      completed: '✅',
      failed: '❌',
      blocked: '🚫',
    }
    return icons[status]
  }

  const getStatusColor = (status: Workflow['status']) => {
    const colors: Record<Workflow['status'], string> = {
      pending: 'bg-slate-700 text-slate-200',
      in_progress: 'bg-blue-700 text-blue-100',
      completed: 'bg-green-700 text-green-100',
      failed: 'bg-red-700 text-red-100',
      blocked: 'bg-yellow-700 text-yellow-100',
    }
    return colors[status]
  }

  const totalWorkflows = workflows.length
  const completed = workflows.filter(w => w.status === 'completed').length
  const inProgress = workflows.filter(w => w.status === 'in_progress').length
  const failed = workflows.filter(w => w.status === 'failed').length
  const pending = workflows.filter(w => w.status === 'pending').length

  if (!teamId) return <div className="px-6 text-slate-400">Select a team to view workflows</div>
  if (loading) return <div className="px-6 text-slate-300">⏳ Loading workflows...</div>

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-6 text-white px-6 pt-6">Workflow History</h2>

      {/* Stats Cards */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-slate-500">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-white">{totalWorkflows}</p>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-green-500">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-bold text-green-400">{completed}</p>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-blue-500">
            <p className="text-xs text-slate-400 uppercase tracking-wide">In Progress</p>
            <p className="text-2xl font-bold text-blue-400">{inProgress}</p>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-yellow-500">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">{pending}</p>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-red-500">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Failed</p>
            <p className="text-2xl font-bold text-red-400">{failed}</p>
          </div>
        </div>
      </div>

      {/* Workflows List */}
      <div className="px-6 pb-6">
        {workflows.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">📭 No workflows yet</p>
            <p className="text-slate-500 text-sm mt-1">Start a workflow to see it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="border border-slate-600 rounded-lg p-4 hover:border-slate-500 hover:bg-slate-700/50 transition">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getStatusIcon(workflow.status)}</span>
                      <h3 className="font-semibold text-white text-lg">{workflow.goal}</h3>
                    </div>
                    <p className="text-sm text-slate-400 mb-1">Conv: <code className="bg-slate-900 px-2 py-0.5 rounded text-xs">{workflow.conversation_id}</code></p>
                    <p className="text-xs text-slate-500">🕐 {new Date(workflow.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(workflow.status)}`}>
                      {workflow.status.toUpperCase()}
                    </span>
                    <code className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">{workflow.id.substring(0, 15)}...</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
