// GET /api/analytics/call-logs - Call logs analytics
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export const dynamic = 'force-dynamic';

interface CallLogsAnalytics {
  totalWebhooks: number;
  recordingsProcessed: number;
  transcriptionsStarted: number;
  transcriptionsCompleted: number;
  mindmapsCreated: number;
  byEventType: Record<string, number>;
  byProvider: Record<string, number>;
  dailyWebhooks: Array<{ date: string; count: number }>;
  dailyRecordings: Array<{ date: string; count: number }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      start: string;
      end: string;
    };

    const startDate = new Date(body.start);
    const endDate = new Date(body.end);

    // Query analyticsEvents for call_log and net2phone_webhook events
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }
    const callLogEventsSnapshot = await adminDb
      .collection("analyticsEvents")
      .where("type", "==", "call_log")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .get();

    const webhookEventsSnapshot = await adminDb
      .collection("analyticsEvents")
      .where("type", "==", "net2phone_webhook")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .get();

    const callLogEvents = callLogEventsSnapshot.docs.map(doc => doc.data());
    const webhookEvents = webhookEventsSnapshot.docs.map(doc => doc.data());

    // Calculate metrics
    const totalWebhooks = webhookEvents.length;
    const recordingsProcessed = callLogEvents.filter(e => e.eventType === "recording_synced").length;
    const transcriptionsStarted = callLogEvents.filter(e => e.eventType === "transcription_started").length;
    const transcriptionsCompleted = callLogEvents.filter(e => e.eventType === "transcription_completed").length;
    const mindmapsCreated = callLogEvents.filter(e => e.eventType === "mindmap_created").length;

    // Group by event type
    const byEventType: Record<string, number> = {};
    [...callLogEvents, ...webhookEvents].forEach(e => {
      byEventType[e.eventType] = (byEventType[e.eventType] || 0) + 1;
    });

    // Group by provider
    const byProvider: Record<string, number> = {};
    callLogEvents.forEach(e => {
      const provider = e.metadata?.provider || "unknown";
      byProvider[provider] = (byProvider[provider] || 0) + 1;
    });

    // Daily breakdown
    const dailyWebhooksMap = new Map<string, number>();
    const dailyRecordingsMap = new Map<string, number>();

    webhookEvents.forEach(e => {
      const date = e.timestamp?.toDate?.() || new Date(e.timestamp);
      const dateKey = date.toISOString().split('T')[0];
      dailyWebhooksMap.set(dateKey, (dailyWebhooksMap.get(dateKey) || 0) + 1);
    });

    callLogEvents.filter(e => e.eventType === "recording_synced").forEach(e => {
      const date = e.timestamp?.toDate?.() || new Date(e.timestamp);
      const dateKey = date.toISOString().split('T')[0];
      dailyRecordingsMap.set(dateKey, (dailyRecordingsMap.get(dateKey) || 0) + 1);
    });

    const dailyWebhooks = Array.from(dailyWebhooksMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dailyRecordings = Array.from(dailyRecordingsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const analytics: CallLogsAnalytics = {
      totalWebhooks,
      recordingsProcessed,
      transcriptionsStarted,
      transcriptionsCompleted,
      mindmapsCreated,
      byEventType,
      byProvider,
      dailyWebhooks,
      dailyRecordings,
    };

    return NextResponse.json({ data: analytics });
  } catch (error: any) {
    console.error("[analytics/call-logs] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch call logs analytics" },
      { status: 500 }
    );
  }
}

