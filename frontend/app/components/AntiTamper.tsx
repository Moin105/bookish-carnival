'use client'

import { useEffect, useRef } from 'react'

/**
 * Advanced anti-tampering component
 * Only triggers when DevTools is actually open and DOM is modified
 */
export default function AntiTamper() {
  const mutationObserverRef = useRef<MutationObserver>()
  const devToolsOpenRef = useRef<boolean>(false)
  const lastReloadRef = useRef<number>(0)

  useEffect(() => {
    // Check if DevTools is open (only check, don't reload immediately)
    const checkDevToolsOpen = (): boolean => {
      // Method 1: Window size difference
      const threshold = 200 // Increased threshold to avoid false positives
      if (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      ) {
        return true
      }

      // Method 2: Debugger timing (only if DevTools is open)
      try {
        const start = performance.now()
        // eslint-disable-next-line no-debugger
        debugger
        const end = performance.now()
        if (end - start > 100) {
          return true
        }
      } catch (e) {
        // Ignore errors
      }

      return false
    }

    // Monitor DOM mutations - ONLY when DevTools is open
    const setupMutationObserver = () => {
      const observer = new MutationObserver((mutations) => {
        // First check if DevTools is open
        const devToolsOpen = checkDevToolsOpen()
        devToolsOpenRef.current = devToolsOpen

        // Only check for tampering if DevTools is actually open
        if (!devToolsOpen) {
          return // Don't do anything if DevTools is closed
        }

        // Prevent multiple reloads in quick succession
        const now = Date.now()
        if (now - lastReloadRef.current < 2000) {
          return // Don't reload if we just reloaded recently
        }

        let suspiciousChange = false

        mutations.forEach((mutation) => {
          // Skip React/Next.js legitimate updates
          const target = mutation.target as HTMLElement
          if (!target) return

          // Check if this is a React/Next.js update
          const isReactUpdate =
            target.hasAttribute('data-nextjs-scroll-focus-boundary') ||
            target.closest('[data-nextjs-scroll-focus-boundary]') ||
            target.closest('[data-nextjs-root]') ||
            target.closest('[data-reactroot]') ||
            target.classList.contains('react-component') ||
            target.getAttribute('data-react-helmet') !== null

          if (isReactUpdate) {
            return // Skip React updates
          }

          // Check for attribute changes that might indicate tampering
          if (mutation.type === 'attributes') {
            const attrName = mutation.attributeName

            // Only check for dangerous attributes
            if (
              attrName === 'onclick' ||
              attrName === 'onerror' ||
              attrName === 'onload'
            ) {
              const newValue = target.getAttribute(attrName) || ''
              // Check for dangerous patterns
              if (
                /javascript:/i.test(newValue) ||
                /eval\s*\(/i.test(newValue) ||
                /on\w+\s*=/i.test(newValue)
              ) {
                suspiciousChange = true
              }
            }
          }

          // Check for node additions that might be malicious
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement

                // Skip if it's a React component
                if (
                  element.hasAttribute('data-reactroot') ||
                  element.hasAttribute('data-nextjs-root')
                ) {
                  return
                }

                // Check for suspicious elements
                if (
                  element.tagName === 'SCRIPT' ||
                  (element.tagName === 'IFRAME' &&
                    !element.hasAttribute('data-legitimate')) ||
                  (element.tagName === 'DIV' &&
                    element.getAttribute('onclick') &&
                    !element.closest('[data-nextjs-root]'))
                ) {
                  suspiciousChange = true
                }
              }
            })
          }
        })

        // Only reload if DevTools is open AND suspicious change detected
        if (suspiciousChange && devToolsOpen) {
          lastReloadRef.current = Date.now()
          console.clear()
          window.location.reload()
        }
      })

      // Observe the entire document
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['onclick', 'onerror', 'onload', 'style'], // Only watch specific attributes
        attributeOldValue: false, // Don't need old values
        characterData: false, // Don't watch text changes (React updates text frequently)
      })

      mutationObserverRef.current = observer
    }

    // Initialize
    setupMutationObserver()

    // Cleanup
    return () => {
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect()
      }
    }
  }, [])

  return null
}
