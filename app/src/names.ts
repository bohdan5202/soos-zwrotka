// Nazwy ofert nie są on-chain: zapamiętujemy je lokalnie u sprzedawcy
// i przekazujemy kupującym w linku (?name=...).
const NAMES_KEY = 'zwrotka:names'

export function loadNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveName(addr: string, name: string) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify({ ...loadNames(), [addr]: name }))
  } catch {
    /* brak dostępu do localStorage: nazwa zostaje tylko w linku */
  }
}

export const DEFAULT_NAME = 'Kurs: Solana i Anchor od podstaw'
