#!/usr/bin/env bash
# Sprawdza, czy środowisko zgadza się z wersjami przypiętymi w projekcie.
# Wyjście: 0 = wszystko OK, 1 = coś wymaga poprawy (linie FAIL).
set -u

WANT_SOLANA="3.1.10"
WANT_ANCHOR="1.2.0"
WANT_NODE_MAJOR="24"

fail=0
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=1; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; }

has() { command -v "$1" >/dev/null 2>&1; }

echo "== Narzędzia"
if has solana; then
  v=$(solana --version | awk '{print $2}')
  [ "$v" = "$WANT_SOLANA" ] && ok "solana $v" || bad "solana $v (wymagane $WANT_SOLANA: avm use $WANT_ANCHOR albo agave-install init $WANT_SOLANA)"
else
  bad "brak solana w PATH"
fi

has cargo-build-sbf && ok "cargo-build-sbf $(cargo-build-sbf --version | head -1 | awk '{print $NF}')" || bad "brak cargo-build-sbf (instaluje się razem z Solana CLI)"

if has anchor; then
  v=$(anchor --version | awk '{print $2}')
  [ "$v" = "$WANT_ANCHOR" ] && ok "anchor $v" || bad "anchor $v (wymagane $WANT_ANCHOR: avm install $WANT_ANCHOR && avm use $WANT_ANCHOR)"
else
  bad "brak anchor w PATH (avm install $WANT_ANCHOR && avm use $WANT_ANCHOR)"
fi

has avm && ok "avm $(avm --version | awk '{print $2}')" || bad "brak avm"
has rustup && ok "rustup $(rustup --version 2>/dev/null | head -1 | awk '{print $2}')" || bad "brak rustup (cargo-build-sbf go wymaga)"
has cargo && ok "cargo $(cargo --version | awk '{print $2}')" || bad "brak cargo"

if has node; then
  v=$(node --version | sed 's/^v//')
  [ "${v%%.*}" = "$WANT_NODE_MAJOR" ] && ok "node $v" || warn "node $v (zalecane $WANT_NODE_MAJOR.x, ważne dopiero przy frontendzie)"
else
  warn "brak node (potrzebny dopiero do frontendu)"
fi

has git && ok "git $(git --version | awk '{print $3}')" || bad "brak git"

echo "== Portfel i sieć"
if has solana; then
  url=$(solana config get | awk -F': ' '/RPC URL/ {print $2}' | xargs)
  case "$url" in
    *devnet*) ok "RPC: $url" ;;
    *) warn "RPC: $url (dla pracy zespołowej: solana config set --url devnet)" ;;
  esac
  kp=$(solana config get | awk -F': ' '/Keypair Path/ {print $2}' | xargs)
  if [ -f "$kp" ]; then
    ok "keypair: $kp ($(solana address))"
    bal=$(solana balance -ud 2>/dev/null || echo "?")
    case "$bal" in
      0\ SOL|\?) warn "saldo devnet: $bal (pobierz SOL: https://faucet.solana.com)" ;;
      *) ok "saldo devnet: $bal" ;;
    esac
  else
    bad "brak keypaira ($kp): solana-keygen new --no-bip39-passphrase"
  fi
fi

echo
if [ $fail -eq 0 ]; then echo "Środowisko OK. Dalej: make test"; else echo "Są błędy (FAIL) do poprawienia."; fi
exit $fail
