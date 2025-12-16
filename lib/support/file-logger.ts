/**
 * File Logger for Support Errors
 * 
 * Writes errors to /downloads/mindmap/support-errors/YYYY-MM-DD.jsonl
 * Also writes per-user and per-workspace logs.
 * Falls back to Firebase Storage if filesystem unavailable.
 */

import * as fs from 'fs'
import * as path from 'path'
import { SupportErrorEvent } from '@/lib/types'
import { adminDb } from '@/lib/firebase-admin'

const LOG_BASE_DIR = '/Users/GabrielLeubitz/Downloads/mindmap/support-errors'
const DATE_FORMAT = 'YYYY-MM-DD'

function getDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ensureDirectory(dir: string): void {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  } catch (error) {
    console.error('[FileLogger] Failed to create directory:', dir, error)
  }
}

function writeToFile(filePath: string, data: string): boolean {
  try {
    ensureDirectory(path.dirname(filePath))
    fs.appendFileSync(filePath, data + '\n', { encoding: 'utf8' })
    return true
  } catch (error) {
    console.error('[FileLogger] Failed to write to file:', filePath, error)
    return false
  }
}

async function writeToStorage(
  storagePath: string,
  data: string
): Promise<boolean> {
  try {
    if (!adminDb) return false
    
    // Use Firebase Storage as fallback
    // For now, we'll log to Firestore as a backup
    const storageRef = adminDb
      .collection('support_error_logs')
      .doc()
    
    await storageRef.set({
      path: storagePath,
      content: data,
      timestamp: new Date(),
    })
    
    return true
  } catch (error) {
    console.error('[FileLogger] Failed to write to storage:', error)
    return false
  }
}

/**
 * Log error to daily file
 */
export async function logError(error: SupportErrorEvent): Promise<void> {
  const dateStr = getDateString()
  const logLine = JSON.stringify({
    id: error.id,
    timestamp: error.created_at.toISOString(),
    message: error.message,
    app_area: error.app_area,
    user_id: error.user_id,
    workspace_id: error.workspace_id,
    expected: error.expected,
    critical: error.critical,
    severity: error.severity,
    source: error.source,
    route: error.route,
    action: error.action,
    error_code: error.error_code,
    metadata: error.metadata,
  })
  
  // Main daily log
  const dailyLogPath = path.join(LOG_BASE_DIR, `${dateStr}.jsonl`)
  const success = writeToFile(dailyLogPath, logLine)
  
  if (!success) {
    // Fallback to storage
    await writeToStorage(`support-errors/${dateStr}.jsonl`, logLine)
  }
  
  // Per-user log
  if (error.user_id) {
    const userLogPath = path.join(
      LOG_BASE_DIR,
      'users',
      `${error.user_id}`,
      `${dateStr}.jsonl`
    )
    writeToFile(userLogPath, logLine)
  }
  
  // Per-workspace log
  if (error.workspace_id) {
    const workspaceLogPath = path.join(
      LOG_BASE_DIR,
      'workspaces',
      `${error.workspace_id}`,
      `${dateStr}.jsonl`
    )
    writeToFile(workspaceLogPath, logLine)
  }
}

