// GET /api/analytics/contacts - Contact events analytics
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export const dynamic = 'force-dynamic';

interface ContactsAnalytics {
  totalSearches: number;
  totalResolved: number;
  totalActions: number;
  totalEmailDrafts: number;
  byEventType: Record<string, number>;
  dailySearches: Array<{ date: string; count: number }>;
  dailyResolved: Array<{ date: string; count: number }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      start: string;
      end: string;
    };

    const startDate = new Date(body.start);
    const endDate = new Date(body.end);

    // Query analyticsEvents for contact_event events
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }
    const eventsSnapshot = await adminDb
      .collection("analyticsEvents")
      .where("type", "==", "contact_event")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .get();

    const events = eventsSnapshot.docs.map(doc => doc.data());

    // Calculate metrics
    const totalSearches = events.filter(e => e.eventType === "contact_searched").length;
    const totalResolved = events.filter(e => e.eventType === "contact_resolved").length;
    const totalActions = events.filter(e => e.eventType === "contact_action").length;
    const totalEmailDrafts = events.filter(e => e.eventType === "email_draft_created").length;

    // Group by event type
    const byEventType: Record<string, number> = {};
    events.forEach(e => {
      byEventType[e.eventType] = (byEventType[e.eventType] || 0) + 1;
    });

    // Daily breakdown
    const dailySearchesMap = new Map<string, number>();
    const dailyResolvedMap = new Map<string, number>();

    events.forEach(e => {
      const date = e.timestamp?.toDate?.() || new Date(e.timestamp);
      const dateKey = date.toISOString().split('T')[0];

      if (e.eventType === "contact_searched") {
        dailySearchesMap.set(dateKey, (dailySearchesMap.get(dateKey) || 0) + 1);
      } else if (e.eventType === "contact_resolved") {
        dailyResolvedMap.set(dateKey, (dailyResolvedMap.get(dateKey) || 0) + 1);
      }
    });

    const dailySearches = Array.from(dailySearchesMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dailyResolved = Array.from(dailyResolvedMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const analytics: ContactsAnalytics = {
      totalSearches,
      totalResolved,
      totalActions,
      totalEmailDrafts,
      byEventType,
      dailySearches,
      dailyResolved,
    };

    return NextResponse.json({ data: analytics });
  } catch (error: any) {
    console.error("[analytics/contacts] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch contacts analytics" },
      { status: 500 }
    );
  }
}

