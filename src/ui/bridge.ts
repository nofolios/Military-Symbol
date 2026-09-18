/** Thin wrapper over the postMessage channel to the plugin sandbox. */
import type { PluginMessage, UiMessage } from '../shared/messages'

export function send(msg: UiMessage) {
  parent.postMessage({ pluginMessage: msg }, '*')
}

type Handler = (msg: PluginMessage) => void
const handlers = new Set<Handler>()

window.addEventListener('message', event => {
  const msg = (event.data as { pluginMessage?: PluginMessage } | undefined)?.pluginMessage
  if (!msg || typeof msg.type !== 'string') return
  for (const h of handlers) h(msg)
})

export function onPluginMessage(h: Handler): () => void {
  handlers.add(h)
  return () => handlers.delete(h)
}

let nonceCounter = 0
const pending = new Map<string, (value: unknown) => void>()

onPluginMessage(msg => {
  if (msg.type === 'storage-value') {
    const resolve = pending.get(msg.nonce)
    if (resolve) {
      pending.delete(msg.nonce)
      resolve(msg.value)
    }
  }
})

/** Read a value from `figma.clientStorage`. */
export function storageGet<T>(key: string, timeoutMs = 2000): Promise<T | null> {
  const nonce = `n${++nonceCounter}`
  return new Promise<T | null>(resolve => {
    const timer = setTimeout(() => {
      pending.delete(nonce)
      resolve(null)
    }, timeoutMs)
    pending.set(nonce, value => {
      clearTimeout(timer)
      resolve((value ?? null) as T | null)
    })
    send({ type: 'storage-get', key, nonce })
  })
}

export function storageSet(key: string, value: unknown) {
  send({ type: 'storage-set', key, value })
}

export const notify = (message: string, error = false) => send({ type: 'notify', message, error })
