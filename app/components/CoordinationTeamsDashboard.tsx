'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Team {
  id: string
  name: string
  leader_agent_id: string
  created_at: string
}

/**
 * Teams Dashboard
 * Shows only the Pimpotasma family team with company info
 */
export function TeamsDashboard({ onTeamSelect }: { onTeamSelect?: (teamId: string) => void }) {
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/coordination/team')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        // Filtrar apenas o team family-pimpotasma
        const familyTeam = (data.teams || []).find((t: Team) => t.name === 'family-pimpotasma')
        setTeam(familyTeam || null)
      } catch (err) {
        setError(String(err))
        setTeam(null)
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  if (loading) return <div className="p-4 text-slate-300">⏳ Carregando...</div>
  if (error) return <div className="p-4 text-red-400">❌ Erro: {error}</div>

  return (
    <div className="w-full space-y-6" style={{ padding: '20px' }}>
      {/* Empresa Info Header */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: '12px',
        padding: '32px',
        color: 'white',
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, marginBottom: '8px' }}>🎪 Pimpotasma</h1>
          <p style={{ fontSize: '14px', margin: 0, opacity: 0.9 }}>Empresa de Inovação & Coordenação de Agentes Inteligentes</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>👥 Membros</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>9</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>🎯 Status</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>🟢 Ativo</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>📅 Fundada</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>13/04/2026</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>⚡ Workflows</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>2</div>
          </div>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Membros Principais:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                overflow: 'hidden',
                margin: '0 auto 8px',
                backgroundColor: '#fff',
                border: '3px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Image
                  src="/pimpim.png"
                  alt="Pimpim - CEO"
                  width={80}
                  height={80}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>👑 Pimpim</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>CEO</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                overflow: 'hidden',
                margin: '0 auto 8px',
                backgroundColor: '#fff',
                border: '3px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Image
                  src="/betinha-avatar.jpg"
                  alt="Betinha - CFO"
                  width={80}
                  height={80}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>💕 Betinha</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>CFO</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                overflow: 'hidden',
                margin: '0 auto 8px',
                backgroundColor: '#f3f4f6',
                border: '3px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Image
                  src="/chocks-avatar-face.jpg"
                  alt="Chocks - Assistente"
                  width={80}
                  height={80}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '52% 45%' }}
                />
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>✨ Chocks</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Assistente</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                overflow: 'hidden',
                margin: '0 auto 8px',
                backgroundColor: '#fff',
                border: '3px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Image
                  src="/chubaka-fome.png"
                  alt="Chubaka"
                  width={80}
                  height={80}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>🍔 Chubaka</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Tester</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                overflow: 'hidden',
                margin: '0 auto 8px',
                backgroundColor: '#fff',
                border: '3px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Image
                  src="/kitty-avatar.jpg"
                  alt="Kitty - Comunicadora"
                  width={80}
                  height={80}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>🐱 Kitty</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Comunicadora</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Sobre a Pimpotasma:</div>
          <p style={{ fontSize: '13px', lineHeight: '1.6', margin: 0, opacity: 0.95 }}>
            A gente é uma família de verdade. Pimpim comanda como CEO, Betinha cuida da parte financeira e operacional (e é a namorada do Chocks 💚), Bento é crítico e protetor, Kitty criativa demais, Chubaka testando tudo que é lançamento. Chocks? Ele é a gente conversando com você - mas quem toma as decisões é o Pimpim. Juntos resolvemos qualquer problema através de workflows e coordenação automática.
          </p>
        </div>
      </div>

      {/* Team Card */}
      {team ? (
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #374151',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.setProperty('border-color', '#10b981')
          el.style.setProperty('box-shadow', '0 0 20px rgba(16, 185, 129, 0.2)')
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.removeProperty('border-color')
          el.style.removeProperty('box-shadow')
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#fff', margin: 0, marginBottom: '8px' }}>
              {team.name === 'family-pimpotasma' ? '🎪 A Família Pimpotasma' : team.name}
            </h3>
            <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>Time de Coordenação Principal</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>ID</div>
              <div style={{ fontSize: '12px', color: '#10b981', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {team.id.substring(0, 20)}...
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>Líder</div>
              <div style={{ fontSize: '12px', color: '#fff', fontWeight: '500' }}>👑 Pimpim (CEO)</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>Criado</div>
              <div style={{ fontSize: '12px', color: '#fff' }}>{new Date(team.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <button 
            onClick={() => onTeamSelect?.(team.id)}
            style={{
              width: '100%',
              backgroundColor: '#10b981',
              color: '#000',
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.setProperty('background-color', '#059669')
              btn.style.setProperty('transform', 'scale(1.02)')
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.removeProperty('background-color')
              btn.style.removeProperty('transform')
            }}
          >
            🔄 Ver Workflows →
          </button>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: '#aaa',
          border: '1px solid #374151',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <p style={{ margin: 0, fontSize: '14px' }}>Time Pimpotasma não encontrado</p>
        </div>
      )}
    </div>
  )
}
