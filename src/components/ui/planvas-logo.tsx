'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export interface PlanvasLogoProps {
  /** Pixel dimension (width & height) of the square logo mark. Default: 32 */
  size?: number
  /** Additional classes for the SVG element */
  className?: string
}

/**
 * Planvas brand mark:
 * Combines "Plan" (a 3-2-1 stepped allocation chip grid forming a "P")
 * and "Canvas" (an artist paintbrush painting the active golden allocation chip).
 */
export function PlanvasLogo({ size = 32, className }: PlanvasLogoProps) {
  const uid = useId().replace(/:/g, '')
  const bgId = `pvBg-${uid}`
  const goldId = `pvGold-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('flex-shrink-0 select-none', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34B254" />
          <stop offset="50%" stopColor="#216E39" />
          <stop offset="100%" stopColor="#113C20" />
        </linearGradient>
        <linearGradient id={goldId} x1="13" y1="13" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>

      {/* Rounded Canvas Squircle */}
      <rect x="1" y="1" width="30" height="30" rx="7.5" fill={`url(#${bgId})`} />
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
      />

      {/* Unpainted Ghost Grid Slots (Lower-Right Canvas Matrix) */}
      <rect x="20.4" y="13.1" width="5.8" height="5.8" rx="1.7" fill="#FFFFFF" fillOpacity="0.12" />
      <rect x="13.1" y="20.4" width="5.8" height="5.8" rx="1.7" fill="#FFFFFF" fillOpacity="0.12" />

      {/* 3-2-1 Allocation Chips Forming the "P" Monogram */}
      {/* Row 1: 100%, 90%, 70% Mint */}
      <rect x="5.8" y="5.8" width="5.8" height="5.8" rx="1.7" fill="#FFFFFF" />
      <rect x="13.1" y="5.8" width="5.8" height="5.8" rx="1.7" fill="#FFFFFF" fillOpacity="0.90" />
      <rect x="20.4" y="5.8" width="5.8" height="5.8" rx="1.7" fill="#9BE9A8" />

      {/* Row 2: 95% Stem + Active Painted Golden-Amber Chip */}
      <rect x="5.8" y="13.1" width="5.8" height="5.8" rx="1.7" fill="#FFFFFF" fillOpacity="0.95" />
      <rect x="13.1" y="13.1" width="5.8" height="5.8" rx="1.7" fill={`url(#${goldId})`} />

      {/* Row 3: Stem Leg of "P" */}
      <rect x="5.8" y="20.4" width="5.8" height="5.8" rx="1.7" fill="#9BE9A8" />

      {/* Artist Paintbrush Painting the Center Golden Chip */}
      <g>
        <path
          d="M17.2 16.5 C19.2 16.0 21.4 17.0 22.3 18.8 L27.2 23.7 C28.1 24.6 28.1 26.1 27.2 27.0 C26.3 27.9 24.8 27.9 23.9 27.0 L19.0 22.1 C17.2 21.2 16.2 19.0 16.7 17.0 Z"
          fill="#123E21"
          fillOpacity="0.85"
        />
        <path
          d="M21.8 19.9 L26.7 24.8 C27.4 25.5 27.4 26.5 26.7 27.1 C26.1 27.7 25.1 27.7 24.4 27.1 L19.5 22.2 Z"
          fill="#FFFFFF"
        />
        <path
          d="M17.4 16.8 C19.2 16.4 21.2 17.3 21.8 19.0 C22.1 20.0 21.3 21.2 20.3 21.5 C18.5 21.9 16.9 20.4 17.0 18.4 C17.0 17.4 17.1 16.9 17.4 16.8 Z"
          fill={`url(#${goldId})`}
        />
      </g>
    </svg>
  )
}
