import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  let d: Date
  if (typeof date === 'string') {
    d = new Date(date)
  } else if (date instanceof Date) {
    d = date
  } else if (date && typeof date === 'object' && 'toDate' in date && typeof (date as any).toDate === 'function') {
    // Firestore Timestamp
    d = (date as any).toDate()
  } else {
    return '-'
  }
  
  // Check if date is valid
  if (isNaN(d.getTime())) {
    return '-'
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  let d: Date
  if (typeof date === 'string') {
    d = new Date(date)
  } else if (date instanceof Date) {
    d = date
  } else if (date && typeof date === 'object' && 'toDate' in date && typeof (date as any).toDate === 'function') {
    // Firestore Timestamp
    d = (date as any).toDate()
  } else {
    return '-'
  }
  
  // Check if date is valid
  if (isNaN(d.getTime())) {
    return '-'
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

