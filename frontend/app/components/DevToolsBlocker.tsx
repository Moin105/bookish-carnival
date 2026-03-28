'use client'

import { useEffect, useRef } from 'react'

/**
 * Advanced DevTools blocker - Only blocks shortcuts, doesn't auto-reload
 * Reload only happens when DevTools is open AND DOM is actually modified
 */
export default function DevToolsBlocker() {
  const reloadCooldownRef = useRef<number>(0)

  useEffect(() => {
    // Comprehensive keyboard shortcut blocking
    const blockKeyboardShortcuts = (e: KeyboardEvent) => {
      // F12 - Open DevTools
      if (e.key === 'F12') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+Shift+I - Chrome/Edge DevTools
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.keyCode === 73)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+Shift+J - Chrome/Edge Console
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.keyCode === 74)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+Shift+C - Chrome/Edge Inspect Element
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.keyCode === 67)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+Shift+K - Firefox Console
      if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.keyCode === 75)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+U - View Source
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+S - Save Page
      if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+Shift+E - Firefox Network Monitor
      if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.keyCode === 69)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+Shift+A - Firefox Debugger
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.keyCode === 65)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Ctrl+Shift+S - Firefox Screenshot
      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.keyCode === 83)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Alt+Shift+I - Edge DevTools
      if (e.altKey && e.shiftKey && (e.key === 'I' || e.keyCode === 73)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }

    // DevTools detection - but DON'T auto-reload, just track state
    // The AntiTamper component will handle reloading when DOM is actually modified
    const detectDevTools = () => {
      let devToolsWasOpen = false

      const detectionInterval = setInterval(() => {
        const threshold = 200 // Increased threshold
        const isOpen =
          window.outerHeight - window.innerHeight > threshold ||
          window.outerWidth - window.innerWidth > threshold

        // Only log state change, don't reload
        if (isOpen && !devToolsWasOpen) {
          devToolsWasOpen = true
          // DevTools opened - AntiTamper will handle if DOM is modified
        } else if (!isOpen && devToolsWasOpen) {
          devToolsWasOpen = false
          // DevTools closed - all good
        }
      }, 1000) // Check less frequently

      return () => clearInterval(detectionInterval)
    }

    // Add event listeners
    document.addEventListener('keydown', blockKeyboardShortcuts, true)
    document.addEventListener('keyup', blockKeyboardShortcuts, true)
    document.addEventListener('keypress', blockKeyboardShortcuts, true)

    // Start DevTools detection (but don't auto-reload)
    const cleanup = detectDevTools()

    // Cleanup
    return () => {
      document.removeEventListener('keydown', blockKeyboardShortcuts, true)
      document.removeEventListener('keyup', blockKeyboardShortcuts, true)
      document.removeEventListener('keypress', blockKeyboardShortcuts, true)
      cleanup()
    }
  }, [])

  return null
}
