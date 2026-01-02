# Progress Calls Analytics Verification & Enhancement

## Summary
Verified and enhanced progress call tracking to ensure all available data is captured and displayed in analytics, including user journeys.

## Data Sources Verified

### 1. Progress Calls Collection (`progressCalls`)
**Location:** `/api/analytics/progress-calls/route.ts`

**Fields Tracked:**
- ✅ `userId` - Call participant
- ✅ `workspaceId` - Workspace
- ✅ `batchId` - Batch ID
- ✅ `status` - "pending" | "in_progress" | "completed" | "declined"
- ✅ `createdAt` - Creation timestamp
- ✅ `completedAt` - Completion timestamp
- ✅ `declinedAt` - Decline timestamp
- ✅ `questionsAnswered` - Questions answered count
- ✅ `goalStatus` - Goal status distribution
- ✅ `sourceCallId` - For follow-up calls tracking
- ✅ `duration` - Call duration (or calculated from createdAt/completedAt)

**Metrics Calculated:**
- Total calls, completed calls, pending calls, declined calls
- Completion rate
- Average questions answered
- Average duration (calculated if not stored)
- Goal status distribution
- Follow-up calls (via sourceCallId)
- Daily breakdown (created vs completed)
- Calls by workspace
- Calls by user
- Status breakdown

### 2. Progress Call Batches Collection (`progressCallBatches`)
**Fields Tracked:**
- ✅ `status` - "draft" | "active" | "completed"
- ✅ `completionPercentage` - 0-100
- ✅ `totalCalls` - Total calls in batch
- ✅ `completedCalls` - Completed calls count
- ✅ `createdAt`, `completedAt`

**Metrics Calculated:**
- Total batches
- Completed batches
- Batch completion rate

### 3. Analytics Events (Future Enhancement)
**Note:** Progress call events are not currently tracked in `analyticsEvents` collection, but the endpoint is prepared to handle them if added in the future.

## User Journey Integration

### Enhanced Journey Events (`lib/utils/journeys.ts`)

**Added Event Types:**
- ✅ `progress_call` - Progress call events
- ✅ `discussion` - Discussion events

**Progress Call Events in Journey:**
1. **From analyticsEvents** (if tracked):
   - Type: `progress_call`
   - Includes: callId, batchId, status, questionsAnswered, goalStatus

2. **From progressCalls collection** (direct query):
   - Fetches all progress calls for the user in date range
   - Creates journey events with descriptive messages:
     - "Completed progress call (X questions)"
     - "Progress call in progress"
     - "Progress call scheduled"
     - "Progress call declined"
   - Includes metadata: callId, batchId, status, questionsAnswered, goalStatus, completedAt

**Discussion Events in Journey:**
- Fetches discussions where user is a participant
- Creates events: "Started discussion (from progress call batch)"
- Includes metadata: discussionId, batchId, questionId, status

## Enhancements Made

### 1. Progress Calls Analytics Endpoint
- ✅ Enhanced to calculate duration from createdAt/completedAt if duration field not available
- ✅ Added follow-up calls tracking (via sourceCallId)
- ✅ Added calls by workspace breakdown
- ✅ Added calls by user breakdown
- ✅ Added status breakdown
- ✅ Prepared for analyticsEvents integration (if events are added in future)

### 2. User Journey Builder
- ✅ Added progress_call event type
- ✅ Added discussion event type
- ✅ Fetches progress calls directly from progressCalls collection
- ✅ Fetches discussions from discussions collection
- ✅ Creates descriptive journey events with all relevant metadata
- ✅ Handles both analyticsEvents and direct collection queries

### 3. Data Alignment Verification
- ✅ Verified all fields from `SUPER_ADMIN_ANALYTICS_DATA_MAP.md` are being queried
- ✅ Verified collection paths match documentation
- ✅ Verified field names match documentation

## Missing Tracking (Not Currently Implemented in Backend)

The following would require backend changes to track in `analyticsEvents`:

1. **Progress Call Creation Event**
   - Type: `progress_call`
   - Fields: callId, batchId, userId, workspaceId, status: "pending", timestamp

2. **Progress Call Status Change Events**
   - Type: `progress_call_status_change`
   - Fields: callId, oldStatus, newStatus, timestamp

3. **Progress Call Completion Event**
   - Type: `progress_call_completed`
   - Fields: callId, batchId, questionsAnswered, goalStatus, duration, timestamp

4. **Progress Call Mindmap Creation Event**
   - Type: `mindmap_generation` (already tracked, but could include progressCallId in metadata)

## Recommendations

### For Backend Team (mindmap-backup-original)
1. **Add Progress Call Analytics Tracking:**
   ```typescript
   // In backend/src/lib/analytics-tracking.ts
   export async function trackProgressCall(
     callId: string,
     userId: string,
     workspaceId: string | null,
     batchId: string | null,
     status: string,
     metadata?: Record<string, any>
   ): Promise<void> {
     const eventRef = db.collection("analyticsEvents").doc();
     await eventRef.set({
       type: "progress_call",
       callId,
       userId,
       workspaceId: workspaceId || null,
       batchId: batchId || null,
       status,
       metadata: metadata || {},
       timestamp: admin.firestore.Timestamp.now(),
     });
   }
   ```

2. **Call trackProgressCall() in:**
   - Progress call creation endpoints
   - Progress call status update endpoints
   - Progress call completion endpoint

3. **Add progressCallId to mindmap_generation events** when mindmap is created from progress call

### For Analytics Dashboard
- ✅ All current data is being pulled correctly
- ✅ User journeys now include progress calls
- ✅ All available metrics are calculated
- ✅ Ready to receive analyticsEvents if backend adds them

## Testing Checklist

- [x] Progress calls analytics endpoint returns all metrics
- [x] User journey includes progress call events
- [x] User journey includes discussion events
- [x] Duration calculation works (from timestamps)
- [x] Follow-up calls are tracked
- [x] Status breakdown is accurate
- [x] Goal status distribution is accurate
- [x] Daily breakdown works correctly
- [x] Batch metrics are calculated
- [x] No build errors
- [x] No linter errors

## Conclusion

✅ **All available progress call data is being tracked and displayed correctly.**

The analytics dashboard is:
- Pulling from the correct Firestore collections
- Calculating all available metrics
- Displaying progress calls in user journeys
- Ready for future analyticsEvents integration

The only enhancement needed is for the backend to start tracking progress call events in `analyticsEvents` collection for more granular analytics and real-time tracking.

