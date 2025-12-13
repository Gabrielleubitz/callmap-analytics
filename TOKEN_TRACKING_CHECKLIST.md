# Token Tracking Quick Checklist

## ✅ Required Fields for Every `processingJobs` Document

```typescript
{
  tokensIn: number,        // REQUIRED - Input tokens from API response
  tokensOut: number,       // REQUIRED - Output tokens from API response
  costUsd: number,        // REQUIRED - Calculated cost (tokensIn * inputRate + tokensOut * outputRate)
  createdAt: Timestamp,   // REQUIRED - Firestore serverTimestamp()
  mindmapId: string,      // REQUIRED - Links to mindmap document
  workspaceId: string,    // REQUIRED - Links to team/workspace
  model: string,          // REQUIRED - AI model name (e.g., "gpt-4", "claude-3-opus")
}
```

## 🔍 Where to Extract Tokens

### OpenAI API
```typescript
const tokensIn = response.usage?.prompt_tokens || 0
const tokensOut = response.usage?.completion_tokens || 0
```

### Anthropic API
```typescript
const tokensIn = response.usage?.input_tokens || 0
const tokensOut = response.usage?.output_tokens || 0
```

## 📍 Where to Create Documents

Create a `processingJobs` document immediately after EVERY AI API call:
- ✅ Mindmap generation
- ✅ Mindmap regeneration
- ✅ AI-powered edits
- ✅ Summarization
- ✅ Translation
- ✅ Any LLM API call

## ⚠️ Common Mistakes to Avoid

- ❌ Using snake_case (`tokens_in`) instead of camelCase (`tokensIn`)
- ❌ Forgetting to record failed jobs (still record with `status: "failed"`)
- ❌ Missing `mindmapId` or `workspaceId` links
- ❌ Not calculating `costUsd` (set to 0 if unknown, but calculate if possible)
- ❌ Using `Date` object instead of Firestore `Timestamp` for `createdAt`
- ❌ Not recording the `model` field

## 🧪 Quick Test

After implementing, test with one mindmap generation and verify:

```bash
# In Firestore console, check processingJobs collection
# Should see a document with:
# - tokensIn > 0
# - tokensOut > 0  
# - costUsd > 0
# - mindmapId matches your mindmap
# - workspaceId matches your team
# - model is set (e.g., "gpt-4")
```

## 📊 What Analytics Dashboard Needs

The dashboard queries `processingJobs` collection to show:
- Total tokens used (sum of tokensIn + tokensOut)
- Total costs (sum of costUsd)
- Tokens by model (grouped by model field)
- Tokens by team (filtered by workspaceId)
- Tokens by source (linked via mindmapId → mindmaps.sourceType)
- Daily token trends (grouped by createdAt date)
- Expensive sessions (sorted by costUsd)

**If these fields are missing or incorrect, the dashboard will show zero or wrong data.**
