'use client'

import { useEffect, useRef } from 'react'

/**
 * Security Guard - Only monitors for actual tampering when DevTools is open
 * Works alongside DevToolsBlocker and AntiTamper
 */
export default function SecurityGuard() {
  const observerRef = useRef<MutationObserver>()
  const lastReloadRef = useRef<number>(0)

  useEffect(() => {
    // Check if DevTools is open
    const isDevToolsOpen = (): boolean => {
      const threshold = 200
      return (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      )
    }

    // DOM Tampering Detection - ONLY when DevTools is open
    const detectDOMTampering = () => {
      // Store initial scripts (only check for NEW scripts, not React updates)
      const initialScripts = new Set(
        Array.from(document.scripts).map((s) => s.src || s.innerHTML),
      )

      // Create MutationObserver to watch for unauthorized changes
      const observer = new MutationObserver((mutations) => {
        // Only check if DevTools is actually open
        if (!isDevToolsOpen()) {
          return // Don't do anything if DevTools is closed
        }

        // Prevent multiple reloads
        const now = Date.now()
        if (now - lastReloadRef.current < 2000) {
          return
        }

        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            const target = mutation.target as HTMLElement

            // Always allow React/Next.js legitimate updates
            const isReactUpdate =
              target.hasAttribute('data-nextjs-scroll-focus-boundary') ||
              target.closest('[data-nextjs-scroll-focus-boundary]') ||
              target.closest('[data-nextjs-root]') ||
              target.closest('[data-reactroot]')

            if (isReactUpdate) {
              return // Skip React updates
            }

            // Only check for REALLY suspicious patterns (not normal React updates)
            const currentHTML = document.body.innerHTML

            // Check for dangerous patterns that indicate actual tampering
            const dangerousPatterns = [
              /<script[^>]*>[\s\S]*?eval\s*\(/i, // eval in script
              /javascript:\s*eval/i, // javascript:eval
              /onclick\s*=\s*["']\s*javascript:/i, // onclick with javascript:
              /onerror\s*=\s*["']/i, // onerror attribute
            ]

            const isDangerous = dangerousPatterns.some((pattern) =>
              pattern.test(currentHTML),
            )

            if (isDangerous) {
              // Check for new scripts that weren't there initially
              const currentScripts = Array.from(document.scripts).map(
                (s) => s.src || s.innerHTML,
              )
              const newScripts = currentScripts.filter(
                (script) => !initialScripts.has(script),
              )

              // Only reload if there are actually new suspicious scripts
              if (newScripts.length > 0 || isDangerous) {
                lastReloadRef.current = Date.now()
                console.clear()
                localStorage.clear()
                sessionStorage.clear()
                window.location.reload()
              }
            }
          }
        })
      })

      // Observe document changes (but be less aggressive)
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['onclick', 'onerror', 'onload'], // Only watch dangerous attributes
        attributeOldValue: false,
        characterData: false, // Don't watch text changes
      })

      observerRef.current = observer
    }

    // Disable console access (only in production)
    const disableConsole = () => {
      if (process.env.NODE_ENV === 'production') {
        const noop = () => {}
        const methods = [
          'log',
          'debug',
          'info',
          'warn',
          'error',
          'assert',
          'clear',
          'count',
          'dir',
          'dirxml',
          'group',
          'groupCollapsed',
          'groupEnd',
          'profile',
          'profileEnd',
          'table',
          'time',
          'timeEnd',
          'timeStamp',
          'trace',
        ]

        methods.forEach((method) => {
          try {
            ;(console as any)[method] = noop
          } catch (e) {
            // Ignore errors
          }
        })
      }
    }

    // Disable eval and Function constructor (only in production)
    const disableDangerousFunctions = () => {
      if (process.env.NODE_ENV === 'production') {
        try {
          window.eval = function () {
            throw new Error('eval() is disabled for security')
          } as any

          const originalFunction = window.Function
          window.Function = function (...args: any[]) {
            if (args.length > 0 && typeof args[args.length - 1] === 'string') {
              throw new Error('Function constructor is disabled for security')
            }
            return originalFunction(...args)
          } as any
        } catch (e) {
          // Ignore errors in case of strict mode
        }
      }
    }

    // Initialize security measures
    detectDOMTampering()
    disableConsole()
    disableDangerousFunctions()

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return null
}
