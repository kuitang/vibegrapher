/**
 * Connection Status Component - Phase 004
 * Shows Socket.io connection state in the UI
 */

import type { ConnectionState } from '@/services/socketio'
import { Circle } from 'lucide-react'

interface ConnectionStatusProps {
  state: ConnectionState
  className?: string
}

export function ConnectionStatus({ state, className = '' }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (state) {
      case 'connected':
        return 'text-green-500'
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-500'
      case 'disconnected':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusText = () => {
    switch (state) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'reconnecting':
        return 'Reconnecting...'
      case 'disconnected':
        return 'Disconnected'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <Circle 
        className={`h-3 w-3 ${getStatusColor()} ${state === 'connected' ? 'fill-current' : ''}`} 
      />
      <span className="text-muted-foreground">
        {getStatusText()}
      </span>
    </div>
  )
}