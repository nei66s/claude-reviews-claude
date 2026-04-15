'use client'

import { useEffect, useRef } from 'react'
import { AGENT_PROFILES } from '../lib/familyRouting'

interface Command {
  name: string
  description: string
  icon: string
}

const BASE_SLASH_COMMANDS: Command[] = [
  {
    name: 'create-workflow',
    description: 'Atribuir um workflow/tarefas para o time de agentes',
    icon: '⚙️',
  },
  {
    name: 'explain',
    description: 'Explicar um conceito ou código em detalhes',
    icon: '💡',
  },
  {
    name: 'fix',
    description: 'Corrigir um erro ou problema',
    icon: '🔧',
  },
  {
    name: 'new',
    description: 'Criar novo projeto, arquivo ou componente',
    icon: '✨',
  },
  {
    name: 'search',
    description: 'Buscar informações na documentação ou código',
    icon: '🔍',
  },
  {
    name: 'plan',
    description: 'Criar um plano para completar uma tarefa',
    icon: '📋',
  },
  {
    name: 'test',
    description: 'Gerar ou executar testes',
    icon: '✅',
  },
]

const AGENT_SLASH_COMMANDS: Command[] = Object.values(AGENT_PROFILES)
  .filter((agent) => agent.id !== 'chocks')
  .map((agent) => ({
    name: agent.id,
    description: `Chamar ${agent.name} direto no chat`,
    icon: agent.fallbackEmoji,
  }))

const SLASH_COMMANDS: Command[] = [...AGENT_SLASH_COMMANDS, ...BASE_SLASH_COMMANDS]

interface CommandAutocompleteProps {
  isOpen: boolean
  selectedIndex: number
  filteredCommands: Command[]
  onSelectCommand: (command: Command) => void
}

export function CommandAutocomplete({
  isOpen,
  selectedIndex,
  filteredCommands,
  onSelectCommand,
}: CommandAutocompleteProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && menuRef.current) {
      const selectedElement = menuRef.current.querySelector('[data-selected="true"]')
      selectedElement?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [selectedIndex, isOpen])

  if (!isOpen || filteredCommands.length === 0) {
    return null
  }

  return (
    <div ref={menuRef} className="command-autocomplete-menu">
      {filteredCommands.map((command, index) => (
        <div
          key={command.name}
          data-selected={index === selectedIndex}
          className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelectCommand(command)}
        >
          <span className="command-icon">{command.icon}</span>
          <div className="command-content">
            <div className="command-name">/{command.name}</div>
            <div className="command-description">{command.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function useSlashCommands() {
  return SLASH_COMMANDS
}
