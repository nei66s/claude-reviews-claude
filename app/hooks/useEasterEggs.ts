import { useEffect, useState } from 'react'

const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const

/**
 * Configuration options for the useEasterEggs hook
 * @interface EasterEggConfig
 */
interface EasterEggConfig {
  /** Callback triggered on triple-click sequence */
  onClick?: () => void
  /** Callback triggered on custom sequence detection */
  onSequence?: () => void
  /** Callback triggered on Konami code sequence (↑↑↓↓←→←→BA) */
  onKonamiCode?: () => void
}

/**
 * Hook for detecting and handling easter egg triggers
 * 
 * @description Provides utilities for detecting:
 * - Konami code sequences (↑↑↓↓←→←→BA)
 * - Triple-click patterns on specific elements
 * - Custom word sequence typing detection
 * 
 * @example
 * // In a component:
 * const { handleTripleClick, detectWordSequence } = useEasterEggs({
 *   onKonamiCode: () => console.log('Konami activated!')
 * })
 * 
 * @param {EasterEggConfig} config - Configuration object with callbacks
 * @returns {Object} Object with detection utilities
 */
export function useEasterEggs(config: EasterEggConfig = {}) {
  const [konamiSequence, setKonamiSequence] = useState<string[]>([])
  const [, setClickSequence] = useState<string[]>([])

  useEffect(() => {
    // Handle keyboard press for Konami code detection
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'a' ? e.key.toLowerCase() : e.code

      setKonamiSequence((prev) => {
        const newSequence = [...prev, key].slice(-KONAMI_CODE.length)
        // Check if the last keys match the Konami code
        if (newSequence.join(',') === KONAMI_CODE.join(',')) {
          config.onKonamiCode?.()
          return []
        }
        return newSequence
      })
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [config])

  /**
   * Detects triple-click pattern on a specific element
   * 
   * @description Tracks clicks on an element and triggers callback on 3rd consecutive click
   * @example
   * handleTripleClick('pimpim-card')
   * 
   * @param {string} elementId - Unique identifier for the element being tracked
   */
  const handleTripleClick = (elementId: string) => {
    setClickSequence((prev) => {
      const newSequence = [...prev.filter((id) => id !== elementId), elementId]
      if (newSequence.length === 3 && newSequence[0] === elementId && newSequence[1] === elementId && newSequence[2] === elementId) {
        config.onClick?.()
        return []
      }
      return newSequence
    })
  }

  // Word sequence detector (typing specific words)
  /**
   * Detects when a specific word is typed globally on the page
   * 
   * @description Maintains a buffer of typed characters and triggers callback when word is typed
   * Automatically clears buffer on space or enter key
   * @example
   * detectWordSequence('chocks', () => console.log('Chocks detected!'))
   * 
   * @param {string} word - The word to detect (case-insensitive)
   * @param {() => void} callback - Function to call when word is detected
   * @returns {() => void} Cleanup function to remove event listener
   */
  const detectWordSequence = (word: string, callback: () => void) => {
    let buffer = ''

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return

      if (e.key.match(/^[a-zA-Z]$/)) {
        buffer = (buffer + e.key.toLowerCase()).slice(-word.length)
        if (buffer === word.toLowerCase()) {
          callback()
          buffer = ''
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        buffer = ''
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }

  return {
    handleTripleClick,
    detectWordSequence,
    konamiActivated: konamiSequence.join(',') === KONAMI_CODE.join(','),
  }
}
