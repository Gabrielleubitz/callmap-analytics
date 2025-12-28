/**
 * Prompt Generator for Cursor
 * 
 * Converts agent recommendations into detailed, actionable Cursor prompts
 * that can be pasted directly into Cursor and executed.
 */

import type { AgentType } from './system-knowledge'
import { getFeatureContext } from './system-knowledge'

export interface PromptGeneratorInput {
  agentType: AgentType
  question: string
  answer: string
  tags?: string[]
  context?: {
    route?: string
    featureId?: string
  }
}

/**
 * Generate a detailed Cursor prompt from an agent's recommendation
 */
export function generateCursorPrompt(input: PromptGeneratorInput): string {
  const { agentType, question, answer, tags = [], context } = input

  // Extract feature context if available
  const featureContext = context
    ? getFeatureContext(context.route, context.featureId)
    : ''

  // Determine likely files/folders based on agent type and question
  const likelyFiles = inferFilesToTouch(agentType, question, answer, context)

  // Extract problem statement and recommendations from answer
  const { problemStatement, currentBehavior, desiredBehavior, recommendations } =
    parseAnswer(answer, agentType)

  // Build the prompt
  let prompt = `# ${agentType === 'product' ? 'Product' : 'Dev'} Improvement: ${question}\n\n`

  // Problem Statement
  prompt += `## Problem Statement\n\n`
  prompt += `${problemStatement}\n\n`

  // Current Behavior
  if (currentBehavior) {
    prompt += `## Current Behavior\n\n`
    prompt += `${currentBehavior}\n\n`
  }

  // Desired Behavior
  prompt += `## Desired Behavior\n\n`
  prompt += `${desiredBehavior}\n\n`

  // Feature Context
  if (featureContext) {
    prompt += `## Feature Context\n\n`
    prompt += `${featureContext}\n\n`
  }

  // Files to Touch
  if (likelyFiles.length > 0) {
    prompt += `## Files/Folders to Touch\n\n`
    likelyFiles.forEach((file) => {
      prompt += `- ${file}\n`
    })
    prompt += `\n`
  }

  // Recommendations
  if (recommendations.length > 0) {
    prompt += `## Implementation Recommendations\n\n`
    recommendations.forEach((rec, idx) => {
      prompt += `${idx + 1}. ${rec}\n`
    })
    prompt += `\n`
  }

  // Edge Cases
  const edgeCases = inferEdgeCases(agentType, question, answer)
  if (edgeCases.length > 0) {
    prompt += `## Edge Cases to Consider\n\n`
    edgeCases.forEach((edgeCase) => {
      prompt += `- ${edgeCase}\n`
    })
    prompt += `\n`
  }

  // Acceptance Criteria
  prompt += `## Acceptance Criteria\n\n`
  const acceptanceCriteria = generateAcceptanceCriteria(agentType, question, answer)
  acceptanceCriteria.forEach((criterion) => {
    prompt += `- [ ] ${criterion}\n`
  })
  prompt += `\n`

  // Implementation Notes
  prompt += `## Implementation Notes\n\n`
  prompt += `- Work in small, incremental steps\n`
  prompt += `- Test each change before moving to the next\n`
  prompt += `- Maintain existing functionality where possible\n`
  if (agentType === 'dev') {
    prompt += `- Consider security implications\n`
    prompt += `- Check for performance impact\n`
  }
  if (agentType === 'product') {
    prompt += `- Ensure changes align with user experience goals\n`
    prompt += `- Consider mobile/responsive design if applicable\n`
  }
  prompt += `\n`

  // Tech Stack Context
  prompt += `## Tech Stack Context\n\n`
  prompt += `- Next.js 14 with App Router\n`
  prompt += `- TypeScript\n`
  prompt += `- Tailwind CSS for styling\n`
  prompt += `- Firestore for database\n`
  prompt += `- Existing components in \`components/ui/\`\n`
  prompt += `- API routes in \`app/api/\`\n`
  prompt += `\n`

  return prompt
}

/**
 * Infer which files/folders are likely to be touched
 */
function inferFilesToTouch(
  agentType: AgentType,
  question: string,
  answer: string,
  context?: { route?: string; featureId?: string }
): string[] {
  const files: string[] = []
  const lowerQuestion = question.toLowerCase()
  const lowerAnswer = answer.toLowerCase()

  // Route-based inference
  if (context?.route) {
    const routePath = context.route
    // Convert route to likely file path
    if (routePath.startsWith('/admin/ai-agents')) {
      files.push('app/admin/ai-agents/page.tsx')
      files.push('app/api/admin/ai-agents/route.ts')
    } else if (routePath.startsWith('/teams')) {
      files.push('app/teams/page.tsx')
      files.push('app/api/teams/route.ts')
    } else if (routePath.startsWith('/users')) {
      files.push('app/users/page.tsx')
      files.push('app/api/users/route.ts')
    } else if (routePath.startsWith('/support')) {
      files.push('app/support/errors/page.tsx')
      files.push('app/api/support/errors/route.ts')
    }
  }

  // Keyword-based inference
  if (lowerQuestion.includes('color') || lowerAnswer.includes('color')) {
    files.push('app/**/page.tsx')
    files.push('components/**/*.tsx')
  }

  if (lowerQuestion.includes('navbar') || lowerAnswer.includes('navbar')) {
    files.push('components/layout/nav.tsx')
  }

  if (lowerQuestion.includes('button') || lowerAnswer.includes('button')) {
    files.push('components/ui/button.tsx')
  }

  if (lowerQuestion.includes('form') || lowerAnswer.includes('form')) {
    files.push('components/ui/input.tsx')
    files.push('components/ui/select.tsx')
  }

  if (lowerQuestion.includes('table') || lowerAnswer.includes('table')) {
    files.push('components/ui/table.tsx')
  }

  // Agent-specific inference
  if (agentType === 'dev') {
    if (lowerQuestion.includes('auth') || lowerAnswer.includes('auth')) {
      files.push('lib/auth/**/*.ts')
      files.push('app/api/**/route.ts')
    }
    if (lowerQuestion.includes('api') || lowerAnswer.includes('api')) {
      files.push('app/api/**/route.ts')
    }
    if (lowerQuestion.includes('security') || lowerAnswer.includes('security')) {
      files.push('app/api/**/route.ts')
      files.push('lib/auth/**/*.ts')
    }
  }

  if (agentType === 'product') {
    if (lowerQuestion.includes('ui') || lowerAnswer.includes('ui')) {
      files.push('components/**/*.tsx')
      files.push('app/**/page.tsx')
    }
    if (lowerQuestion.includes('ux') || lowerAnswer.includes('ux')) {
      files.push('app/**/page.tsx')
      files.push('components/**/*.tsx')
    }
  }

  // Remove duplicates
  return [...new Set(files)]
}

/**
 * Parse answer to extract structured information
 */
function parseAnswer(
  answer: string,
  agentType: AgentType
): {
  problemStatement: string
  currentBehavior?: string
  desiredBehavior: string
  recommendations: string[]
} {
  // Try to extract recommendations from structured format
  let recommendations: string[] = []
  let problemStatement = answer
  let currentBehavior: string | undefined
  let desiredBehavior = answer

  // Look for numbered recommendations
  const numberedMatches = answer.match(/\d+\.\s+([^\n]+)/g)
  if (numberedMatches) {
    recommendations = numberedMatches.map((m) => m.replace(/^\d+\.\s+/, ''))
  }

  // Look for bullet points
  const bulletMatches = answer.match(/[-•]\s+([^\n]+)/g)
  if (bulletMatches && recommendations.length === 0) {
    recommendations = bulletMatches.map((m) => m.replace(/^[-•]\s+/, ''))
  }

  // Try to extract problem/current/desired from common patterns
  const problemMatch = answer.match(/problem[:\s]+([^\n]+)/i)
  if (problemMatch) {
    problemStatement = problemMatch[1]
  }

  const currentMatch = answer.match(/current[:\s]+([^\n]+)/i)
  if (currentMatch) {
    currentBehavior = currentMatch[1]
  }

  const desiredMatch = answer.match(/desired[:\s]+([^\n]+)/i)
  if (desiredMatch) {
    desiredBehavior = desiredMatch[1]
  }

  // If no structured recommendations found, use first 2-3 sentences as recommendations
  if (recommendations.length === 0) {
    const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 20)
    recommendations = sentences.slice(0, 3).map((s) => s.trim())
  }

  return {
    problemStatement: problemStatement.substring(0, 200),
    currentBehavior,
    desiredBehavior: desiredBehavior.substring(0, 300),
    recommendations: recommendations.slice(0, 5),
  }
}

/**
 * Infer edge cases based on agent type and question
 */
function inferEdgeCases(
  agentType: AgentType,
  question: string,
  answer: string
): string[] {
  const edgeCases: string[] = []
  const lowerQuestion = question.toLowerCase()
  const lowerAnswer = answer.toLowerCase()

  // Common edge cases
  if (lowerQuestion.includes('form') || lowerAnswer.includes('form')) {
    edgeCases.push('Handle empty/invalid input')
    edgeCases.push('Handle form submission errors')
  }

  if (lowerQuestion.includes('auth') || lowerAnswer.includes('auth')) {
    edgeCases.push('Handle unauthenticated users')
    edgeCases.push('Handle expired sessions')
  }

  if (lowerQuestion.includes('api') || lowerAnswer.includes('api')) {
    edgeCases.push('Handle API errors gracefully')
    edgeCases.push('Handle rate limiting')
  }

  if (lowerQuestion.includes('mobile') || lowerAnswer.includes('mobile')) {
    edgeCases.push('Test on mobile devices')
    edgeCases.push('Ensure responsive design')
  }

  if (agentType === 'dev') {
    edgeCases.push('Handle null/undefined values')
    edgeCases.push('Consider error handling')
  }

  if (agentType === 'product') {
    edgeCases.push('Consider accessibility (a11y)')
    edgeCases.push('Test with different user roles')
  }

  return edgeCases
}

/**
 * Generate acceptance criteria
 */
function generateAcceptanceCriteria(
  agentType: AgentType,
  question: string,
  answer: string
): string[] {
  const criteria: string[] = []
  const lowerQuestion = question.toLowerCase()
  const lowerAnswer = answer.toLowerCase()

  // Base criteria
  criteria.push('Change works as described')
  criteria.push('No existing functionality is broken')
  criteria.push('Code follows existing patterns and conventions')

  // Agent-specific criteria
  if (agentType === 'dev') {
    criteria.push('Security considerations are addressed')
    criteria.push('Error handling is implemented')
    criteria.push('Performance impact is acceptable')
  }

  if (agentType === 'product') {
    criteria.push('UI/UX is improved as intended')
    criteria.push('Changes are accessible and responsive')
    criteria.push('User experience is enhanced')
  }

  // Question-specific criteria
  if (lowerQuestion.includes('color') || lowerAnswer.includes('color')) {
    criteria.push('Color changes are consistent across the app')
    criteria.push('Color contrast meets accessibility standards')
  }

  if (lowerQuestion.includes('button') || lowerAnswer.includes('button')) {
    criteria.push('Button is properly styled and accessible')
    criteria.push('Button click handlers work correctly')
  }

  if (lowerQuestion.includes('form') || lowerAnswer.includes('form')) {
    criteria.push('Form validation works correctly')
    criteria.push('Form submission handles errors gracefully')
  }

  return criteria
}

