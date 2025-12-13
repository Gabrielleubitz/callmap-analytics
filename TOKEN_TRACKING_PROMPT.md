# Token Tracking Implementation Prompt

## Overview
The analytics dashboard requires comprehensive token usage tracking from the mindmap project. All AI processing jobs must record token consumption and costs to enable accurate analytics, billing, and quota management.

## Critical Requirements

### 1. Firestore Collection: `processingJobs`

Every AI processing job (mindmap generation, edits, exports, etc.) MUST create a document in the `processingJobs` collection with the following REQUIRED fields:

```typescript
{
  // REQUIRED: Token counts
  tokensIn: number,        // Input tokens (prompt tokens)
  tokensOut: number,       // Output tokens (completion tokens)
  
  // REQUIRED: Cost tracking
  costUsd: number,        // Cost in USD (calculate from model pricing)
  
  // REQUIRED: Timestamp
  createdAt: Timestamp,   // Firestore Timestamp of when job was created
  
  // REQUIRED: Linking fields
  mindmapId: string,      // ID of the mindmap/session this job belongs to
  workspaceId: string,    // ID of the team/workspace (for team-level analytics)
  
  // REQUIRED: Model identification
  model: string,          // AI model used (e.g., "gpt-4", "gpt-4-turbo", "claude-3-opus", "claude-3-sonnet")
  
  // OPTIONAL but recommended
  sourceType?: string,    // Source type: "call", "meeting", "upload", "url"
  userId?: string,        // User who triggered the job
  type?: string,          // Job type: "generate", "edit", "export", etc.
  status?: string,        // "completed", "failed", "processing"
  errorMessage?: string, // If status is "failed"
}
```

### 2. Field Name Standards

**Use camelCase for all fields:**
- ✅ `tokensIn` (NOT `tokens_in`)
- ✅ `tokensOut` (NOT `tokens_out`)
- ✅ `costUsd` (NOT `cost_usd`)
- ✅ `createdAt` (NOT `created_at`)
- ✅ `mindmapId` (NOT `mindmap_id`)
- ✅ `workspaceId` (NOT `workspace_id`)
- ✅ `sourceType` (NOT `source_type`)

### 3. When to Create processingJobs Documents

Create a document in `processingJobs` for EVERY AI operation that consumes tokens:

- ✅ **Mindmap Generation**: When generating a new mindmap from uploaded content
- ✅ **Mindmap Regeneration**: When regenerating/updating an existing mindmap
- ✅ **Mindmap Edits**: When AI processes user edits (e.g., expanding nodes, refining content)
- ✅ **Export Processing**: When AI processes exports (if any AI is involved)
- ✅ **Summarization**: When AI summarizes content
- ✅ **Translation**: When AI translates content
- ✅ **Any other AI operation** that calls an LLM API

### 4. Token Extraction from API Responses

Most LLM APIs return token usage in their responses. Extract and store:

**OpenAI API:**
```typescript
const response = await openai.chat.completions.create(...)
const tokensIn = response.usage?.prompt_tokens || 0
const tokensOut = response.usage?.completion_tokens || 0
const totalTokens = response.usage?.total_tokens || 0
```

**Anthropic API:**
```typescript
const response = await anthropic.messages.create(...)
const tokensIn = response.usage?.input_tokens || 0
const tokensOut = response.usage?.output_tokens || 0
```

**Store immediately after API call:**
```typescript
await db.collection('processingJobs').add({
  tokensIn,
  tokensOut,
  costUsd: calculateCost(tokensIn, tokensOut, model), // See cost calculation below
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  mindmapId: mindmapId,
  workspaceId: workspaceId,
  model: model,
  sourceType: sourceType,
  // ... other fields
})
```

### 5. Cost Calculation

Calculate `costUsd` based on the model and token counts. Example pricing (update with actual rates):

```typescript
function calculateCost(tokensIn: number, tokensOut: number, model: string): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
    'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
    'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 },
    'claude-3-opus': { input: 0.015 / 1000, output: 0.075 / 1000 },
    'claude-3-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
    'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
  }
  
  const rates = pricing[model] || { input: 0, output: 0 }
  return (tokensIn * rates.input) + (tokensOut * rates.output)
}
```

### 6. Linking to Sessions/Mindmaps

**CRITICAL**: Every `processingJobs` document MUST have a `mindmapId` that links to a document in the `mindmaps` collection.

The `mindmaps` collection should have:
```typescript
{
  id: string,                    // Document ID
  workspaceId: string,           // Team/workspace ID
  sourceType: string,            // "call", "meeting", "upload", "url"
  createdAt: Timestamp,          // When mindmap was created
  // ... other mindmap fields
}
```

### 7. Error Handling

Even if an AI job fails, still record it:
```typescript
await db.collection('processingJobs').add({
  tokensIn: tokensIn || 0,      // Record what was consumed before failure
  tokensOut: tokensOut || 0,
  costUsd: costUsd || 0,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  mindmapId: mindmapId,
  workspaceId: workspaceId,
  model: model,
  status: 'failed',
  errorMessage: error.message,
})
```

### 8. Batch Operations

If a single operation makes multiple API calls (e.g., processing multiple nodes), create ONE document per API call, or aggregate and create one document with total tokens:

```typescript
// Option 1: One document per API call (recommended for detailed tracking)
for (const node of nodes) {
  const response = await processNode(node)
  await db.collection('processingJobs').add({
    tokensIn: response.usage.prompt_tokens,
    tokensOut: response.usage.completion_tokens,
    // ...
  })
}

// Option 2: Aggregate all calls (if you want one document per operation)
let totalTokensIn = 0
let totalTokensOut = 0
let totalCost = 0

for (const node of nodes) {
  const response = await processNode(node)
  totalTokensIn += response.usage.prompt_tokens
  totalTokensOut += response.usage.completion_tokens
  totalCost += calculateCost(...)
}

await db.collection('processingJobs').add({
  tokensIn: totalTokensIn,
  tokensOut: totalTokensOut,
  costUsd: totalCost,
  // ...
})
```

### 9. Verification Checklist

Before deploying, verify:

- [ ] Every AI API call creates a `processingJobs` document
- [ ] All documents have `tokensIn`, `tokensOut`, `costUsd`, `createdAt`
- [ ] All documents have `mindmapId` linking to a mindmap
- [ ] All documents have `workspaceId` for team-level tracking
- [ ] All documents have `model` field identifying the AI model
- [ ] Cost calculation is accurate for all models
- [ ] Failed jobs are still recorded (with status: "failed")
- [ ] Field names use camelCase (not snake_case)
- [ ] `createdAt` uses Firestore Timestamp (not Date object)

### 10. Testing

Test with a sample job and verify the document appears in Firestore:

```typescript
// After creating a processing job, verify:
const job = await db.collection('processingJobs')
  .where('mindmapId', '==', testMindmapId)
  .limit(1)
  .get()

const data = job.docs[0]?.data()
console.assert(data.tokensIn > 0, 'tokensIn must be > 0')
console.assert(data.tokensOut > 0, 'tokensOut must be > 0')
console.assert(data.costUsd > 0, 'costUsd must be > 0')
console.assert(data.mindmapId === testMindmapId, 'mindmapId must match')
console.assert(data.workspaceId, 'workspaceId must exist')
console.assert(data.model, 'model must exist')
```

## Impact on Analytics Dashboard

The analytics dashboard depends on this data for:

1. **Usage Metrics**: Total tokens, costs, averages
2. **Team Analytics**: Token usage per team, quota tracking
3. **Cost Analysis**: Revenue vs costs, profitability
4. **Model Analytics**: Which models are used most, cost per model
5. **Source Analytics**: Token usage by source type (call, meeting, upload, url)
6. **Expensive Sessions**: Identifying high-cost operations
7. **Daily Charts**: Token consumption trends over time

**Without proper tracking, all these metrics will show zero or incorrect values.**

## Questions to Answer

1. Are you currently creating `processingJobs` documents for all AI operations?
2. Are you extracting `tokensIn` and `tokensOut` from API responses?
3. Are you calculating and storing `costUsd`?
4. Are you linking jobs to mindmaps via `mindmapId`?
5. Are you linking jobs to teams via `workspaceId`?
6. Are you recording the `model` used for each job?
7. Are failed jobs still being recorded?

If any answer is "no", implement the missing pieces immediately.
