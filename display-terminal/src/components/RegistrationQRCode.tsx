'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { getApiUrl } from '@shared/lib/api-url'

interface RegistrationQRCodeProps {
  size?: number
}

export default function RegistrationQRCode({ size = 280 }: RegistrationQRCodeProps) {
  const [registrationUrl, setRegistrationUrl] = useState('')
  const [hostname, setHostname] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Try to get the LAN IP from the health endpoint so the QR code
    // works for phones and other devices on the network (not localhost).
    async function resolveHost() {
      let host = window.location.hostname
      try {
        const baseUrl = getApiUrl().replace(/\/api$/, '')
        const res = await fetch(`${baseUrl}/health`)
        const data = await res.json()
        if (data.ip_addresses && data.ip_addresses.length > 0) {
          host = data.ip_addresses[0]
        }
      } catch {
        // fall back to window hostname
      }
      setHostname(host)
      const port = window.location.port || '3001'
      setRegistrationUrl(`http://${host}:${port}/register`)
    }
    resolveHost()
  }, [])

  if (!registrationUrl) {
    return (
      <div className="qr-registration-container">
        <div className="qr-loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="qr-registration-container">
      <div className="qr-content">
        <h2 className="qr-title">Player Registration</h2>
        <p className="qr-subtitle">Scan to register for tournaments</p>

        <div className="qr-code-wrapper">
          <div className="qr-code-inner">
            <QRCodeSVG
              value={registrationUrl}
              size={size}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="H"
              includeMargin={true}
            />
          </div>
        </div>

        <div className="qr-instructions">
          <div className="qr-step">
            <span className="step-number">1</span>
            <span className="step-text">Open camera on your phone</span>
          </div>
          <div className="qr-step">
            <span className="step-number">2</span>
            <span className="step-text">Point at QR code</span>
          </div>
          <div className="qr-step">
            <span className="step-number">3</span>
            <span className="step-text">Tap the link to register</span>
          </div>
        </div>

        <div className="qr-url">
          <span className="url-label">Or visit:</span>
          <span className="url-text">{registrationUrl}</span>
        </div>
      </div>
    </div>
  )
}
