import React from 'react'
import { createRoot } from 'react-dom/client'
import ReceiptPrinter from './ReceiptPrinter.jsx'
import './fullpage.css'

function Page() {
  const ref = React.useRef(null)
  React.useEffect(() => { window.__printer = ref.current }, [])
  return (
    <div className="fp fp-print">
      <div className="fp-inner">
        <ReceiptPrinter ref={ref} playOnView sound />
      </div>
      <p className="fp-hint">tap to replay</p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Page /></React.StrictMode>)
