import React from 'react'
import { createRoot } from 'react-dom/client'
import PolaroidCamera from './PolaroidCamera.jsx'
import './fullpage.css'

function Page() {
  const ref = React.useRef(null)
  React.useEffect(() => { window.__cam = ref.current }, [])
  return (
    <div className="fp fp-cam">
      <div className="fp-inner">
        <PolaroidCamera ref={ref} playOnView sound />
      </div>
      <p className="fp-hint">tap to replay</p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Page /></React.StrictMode>)
