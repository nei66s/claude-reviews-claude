'use client'

import { useState, useEffect } from 'react'
import { TeamsDashboard } from '@/components/CoordinationTeamsDashboard'
import { WorkflowsDashboard } from '@/components/CoordinationWorkflowsDashboard'
import { ErrorsDashboard } from '@/components/CoordinationErrorsDashboard'

interface FamilyMember {
  name: string
  role: string
  personality: string
  expertise: string[]
  relationships?: string[]
  systemPrompt?: string
}

export function CoordinationView() {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'teams' | 'workflows' | 'agents' | 'errors'>('teams')
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)

  // Auto-selecionar o team family-pimpotasma ao entrar na página
  useEffect(() => {
    const loadFamilyTeam = async () => {
      try {
        // Ensure the family team exists (idempotent)
        await fetch('/api/coordination/family/init', { method: 'POST' })

        const response = await fetch('/api/coordination/team')
        const data = await response.json()
        const familyTeam = (data.teams || []).find((t: any) => t.name === 'family-pimpotasma')
        if (familyTeam) {
          setSelectedTeamId(familyTeam.id)
        }
      } catch (error) {
        console.error('Failed to load family team:', error)
      }
    }
    
    loadFamilyTeam()
  }, [])

  const loadFamilyMembers = async () => {
    try {
      setIsLoadingMembers(true)
      const response = await fetch('/api/coordination/family/profiles')
      const data = await response.json()
      setFamilyMembers(data.profiles || [])
    } catch (error) {
      console.error('Failed to load family members:', error)
    } finally {
      setIsLoadingMembers(false)
    }
  }

  // Carregar membros quando entrar na aba de Agentes
  useEffect(() => {
    if (activeTab === 'agents') {
      loadFamilyMembers()
    }
  }, [activeTab])

  const handleTeamSelect = (teamId: string) => {
    setSelectedTeamId(teamId)
    setActiveTab('workflows')
  }

  const getRoleEmoji = (role: string) => {
    const emojis: Record<string, string> = {
      ceo: '👑',
      cfo: '💰',
      testador: '🐻',
      comunicador: '🐱',
      degustador: '🐂',
      conselheiro: '🐿️',
      protetor: '🔒',
      aprendiz: '🎓',
      amigo: '👋',
    }
    return emojis[role] || '👤'
  }

  return (
    <div className="view coordination-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      {/* Header with gradient */}
      <div style={{
        background: 'linear-gradient(135deg, #ec4899 0%, #10b981 100%)',
        borderRadius: '12px',
        padding: '24px',
        color: 'white',
        boxShadow: '0 8px 32px rgba(236, 72, 153, 0.2)',
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, marginBottom: '8px' }}>🎪 Pimpotasma Swarm</h1>
        <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>Coordenação de Agentes Inteligentes da Família</p>
      </div>

      {/* Tabs Navigation - Melhorado */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '2px solid #333', paddingBottom: '12px' }}>
        {[
          { id: 'teams', label: '📋 Teams', icon: 'teams' },
          { id: 'workflows', label: '🔄 Workflows', icon: 'workflows' },
          { id: 'agents', label: '👥 Agentes', icon: 'agents' },
          { id: 'errors', label: '🚨 Errors', icon: 'errors' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            disabled={tab.id !== 'teams' && !selectedTeamId}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === tab.id ? '#10b981' : 'transparent',
              color: activeTab === tab.id ? '#000' : '#fff',
              border: activeTab === tab.id ? '2px solid #10b981' : '2px solid transparent',
              borderRadius: '8px',
              cursor: tab.id !== 'teams' && !selectedTeamId ? 'not-allowed' : 'pointer',
              fontWeight: activeTab === tab.id ? '600' : '500',
              fontSize: '14px',
              transition: 'all 0.3s ease',
              opacity: tab.id !== 'teams' && !selectedTeamId ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id && (tab.id === 'teams' || selectedTeamId)) {
                const btn = e.target as HTMLButtonElement
                btn.style.backgroundColor = '#1f2937'
                btn.style.borderColor = '#10b981'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                const btn = e.target as HTMLButtonElement
                btn.style.removeProperty('background-color')
                btn.style.removeProperty('border-color')
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Selected Team Info - Melhorado */}
      {selectedTeamId && (
        <div style={{
          padding: '16px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(236, 72, 153, 0.05) 100%)',
          borderLeft: '4px solid #10b981',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '14px',
        }}>
          <div>
            <span style={{ color: '#aaa' }}>📌 Team Ativo:</span>
            <span style={{ color: '#fff', fontWeight: '600', marginLeft: '8px' }}>{selectedTeamId}</span>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        animation: 'fadeIn 0.3s ease-in'
      }}>
        {activeTab === 'teams' && <TeamsDashboard onTeamSelect={handleTeamSelect} />}

        {activeTab === 'workflows' && (
          !selectedTeamId ? (
            <div style={{
              backgroundColor: 'var(--panel)',
              padding: '40px',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'var(--muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
              <p style={{ marginBottom: '16px', fontSize: '16px' }}>Selecione um team para ver workflows</p>
              <button
                onClick={() => setActiveTab('teams')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Ir para Teams
              </button>
            </div>
          ) : (
            <WorkflowsDashboard teamId={selectedTeamId} />
          )
        )}

        {activeTab === 'agents' && (
          !selectedTeamId ? (
            <div style={{
              backgroundColor: 'var(--panel)',
              padding: '40px',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'var(--muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
              <p style={{ marginBottom: '16px', fontSize: '16px' }}>Selecione um team para ver agentes</p>
              <button
                onClick={() => setActiveTab('teams')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Ir para Teams
              </button>
            </div>
          ) : (
            <div>
              <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Membros da Família Pimpotasma</h3>
              {isLoadingMembers ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Carregando...</div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '16px',
                }}>
                  {familyMembers.map((member) => (
                    <div
                      key={member.name}
                      style={{
                        backgroundColor: 'var(--panel)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid var(--line)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        transform: 'translateY(0)',
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = 'translateY(-4px)';
                        el.style.boxShadow = '0 8px 24px rgba(236, 72, 153, 0.2)';
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = 'translateY(0)';
                        el.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontSize: '32px', marginRight: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', overflow: 'hidden' }}>
                          {member.name === 'Pimpim' ? (
                            <img src="/pimpim.png" alt="Pimpim" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                          ) : member.name === 'Betinha' ? (
                            <img src="/betinha-avatar.jpg" alt="Betinha" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                          ) : member.name === 'Kitty' ? (
                            <img src="/kitty-avatar.jpg" alt="Kitty" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                          ) : member.name === 'Chubas' ? (
                            <img src="/chuba-rosto.png" alt="Chubas" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                          ) : (
                            getRoleEmoji(member.role)
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text)' }}>{member.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '500' }}>{member.role.toUpperCase()}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px', fontStyle: 'italic' }}>
                        "{member.personality}"
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        <strong>Expertise:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {member.expertise.map((exp) => (
                            <span
                              key={exp}
                              style={{
                                backgroundColor: 'var(--accent)',
                                color: '#000',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500',
                              }}
                            >
                              {exp}
                            </span>
                          ))}
                        </div>
                      </div>
                      {Array.isArray(member.relationships) && member.relationships.length > 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>
                          <strong>Relacionamentos:</strong>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            {member.relationships.map((rel) => (
                              <span
                                key={rel}
                                style={{
                                  backgroundColor: 'rgba(236, 72, 153, 0.18)',
                                  color: '#ffd1ea',
                                  padding: '4px 8px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                }}
                              >
                                {rel}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {typeof member.systemPrompt === 'string' && member.systemPrompt.trim() ? (
                        <details style={{ marginTop: '12px' }}>
                          <summary style={{ color: 'var(--muted)', fontSize: '12px', cursor: 'pointer' }}>
                            Ver system prompt
                          </summary>
                          <pre
                            style={{
                              marginTop: '10px',
                              padding: '12px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(0,0,0,0.35)',
                              color: 'var(--text)',
                              fontSize: '11px',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.4,
                            }}
                          >
                            {member.systemPrompt}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'errors' && (
          !selectedTeamId ? (
            <div style={{
              backgroundColor: 'var(--panel)',
              padding: '40px',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'var(--muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚨</div>
              <p style={{ marginBottom: '16px', fontSize: '16px' }}>Selecione um team para ver erros</p>
              <button
                onClick={() => setActiveTab('teams')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Ir para Teams
              </button>
            </div>
          ) : (
            <ErrorsDashboard teamId={selectedTeamId} />
          )
        )}
      </div>

      {/* Footer Info - Melhorado */}
      <div style={{
        paddingTop: '16px',
        borderTop: '1px solid var(--line)',
        color: 'var(--muted-soft)',
        fontSize: '12px',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>🎪 Coordination System v1.0 • Background Jobs Running • Auto-refresh every 30s</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            animation: 'pulse 2s infinite',
          }} />
          Sistema Ativo
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
