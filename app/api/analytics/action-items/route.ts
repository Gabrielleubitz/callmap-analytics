// GET /api/analytics/action-items - Action items analytics
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export const dynamic = 'force-dynamic';

interface ActionItemsAnalytics {
  totalCreated: number;
  totalCompleted: number;
  completionRate: number;
  addedToCalendar: number;
  contactResolved: number;
  byEventType: Record<string, number>;
  bySource: Record<string, number>;
  dailyCreated: Array<{ date: string; count: number }>;
  dailyCompleted: Array<{ date: string; count: number }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      start: string;
      end: string;
    };

    const startDate = new Date(body.start);
    const endDate = new Date(body.end);

    // Query analyticsEvents for action_item events
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }
    const eventsSnapshot = await adminDb
      .collection("analyticsEvents")
      .where("type", "==", "action_item")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .get();

    const events = eventsSnapshot.docs.map(doc => doc.data());

    // Calculate metrics
    const totalCreated = events.filter(e => e.eventType === "created").length;
    const totalCompleted = events.filter(e => e.eventType === "completed").length;
    const completionRate = totalCreated > 0 ? totalCompleted / totalCreated : 0;
    const addedToCalendar = events.filter(e => e.eventType === "added_to_calendar").length;
    const contactResolved = events.filter(e => e.eventType === "contact_resolved").length;

    // Group by event type
    const byEventType: Record<string, number> = {};
    events.forEach(e => {
      byEventType[e.eventType] = (byEventType[e.eventType] || 0) + 1;
    });

    // Group by source
    const bySource: Record<string, number> = {};
    events.forEach(e => {
      const source = e.metadata?.source || "unknown";
      bySource[source] = (bySource[source] || 0) + 1;
    });

    // Daily breakdown
    const dailyCreatedMap = new Map<string, number>();
    const dailyCompletedMap = new Map<string, number>();

    events.forEach(e => {
      const date = e.timestamp?.toDate?.() || new Date(e.timestamp);
      const dateKey = date.toISOString().split('T')[0];

      if (e.eventType === "created") {
        dailyCreatedMap.set(dateKey, (dailyCreatedMap.get(dateKey) || 0) + 1);
      } else if (e.eventType === "completed") {
        dailyCompletedMap.set(dateKey, (dailyCompletedMap.get(dateKey) || 0) + 1);
      }
    });

    const dailyCreated = Array.from(dailyCreatedMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dailyCompleted = Array.from(dailyCompletedMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const analytics: ActionItemsAnalytics = {
      totalCreated,
      totalCompleted,
      completionRate,
      addedToCalendar,
      contactResolved,
      byEventType,
      bySource,
      dailyCreated,
      dailyCompleted,
    };

    return NextResponse.json({ data: analytics });
  } catch (error: any) {
    console.error("[analytics/action-items] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch action items analytics" },
      { status: 500 }
    );
  }
}

