import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID } from '../program'

/** Pole na adres: konto należące do programu = oferta, wszystko inne = portfel. */
export function AddressLookup() {
  const { connection } = useConnection()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const open = async () => {
    setError(null)
    let key: PublicKey
    try {
      key = new PublicKey(value.trim())
    } catch {
      setError('To nie jest poprawny adres Solany.')
      return
    }
    setBusy(true)
    const acc = await connection.getAccountInfo(key).catch(() => null)
    setBusy(false)
    navigate(acc?.owner.equals(PROGRAM_ID) ? `/oferta/${key.toBase58()}` : `/portfel/${key.toBase58()}`)
  }

  return (
    <form
      className="lookup"
      onSubmit={(e) => {
        e.preventDefault()
        open()
      }}
    >
      <input placeholder="adres oferty albo portfela" value={value} onChange={(e) => setValue(e.target.value)} />
      <button disabled={!value || busy}>{busy ? 'Sprawdzam…' : 'Sprawdź'}</button>
      {error && <p className="small err-text">{error}</p>}
    </form>
  )
}
