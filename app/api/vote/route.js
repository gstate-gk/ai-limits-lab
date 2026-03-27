import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// POST /api/vote — 投票を保存
export async function POST(request) {
  try {
    const body = await request.json();
    const { q1, q2, q3, q4 } = body;

    if (!q1 || !q2 || !q3 || !q4) {
      return NextResponse.json({ error: '全問回答してください' }, { status: 400 });
    }

    const validVotes = ['A', 'B', 'draw'];
    if (![q1, q2, q3, q4].every(v => validVotes.includes(v))) {
      return NextResponse.json({ error: '不正な投票値です' }, { status: 400 });
    }

    // 投票をKVに保存
    const voteId = `vote:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const vote = { q1, q2, q3, q4, timestamp: new Date().toISOString() };
    await kv.set(voteId, JSON.stringify(vote));

    // 集計を更新
    const questions = ['q1', 'q2', 'q3', 'q4'];
    for (const q of questions) {
      const choice = body[q];
      await kv.hincrby('totals', `${q}:${choice}`, 1);
    }
    await kv.hincrby('totals', 'count', 1);

    return NextResponse.json({ success: true, voteId });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({ error: '投票の保存に失敗しました' }, { status: 500 });
  }
}

// GET /api/vote — 集計結果を取得
export async function GET() {
  try {
    const totals = await kv.hgetall('totals') || {};
    const count = parseInt(totals.count || '0');

    const results = {
      totalVotes: count,
      questions: {},
    };

    const questions = ['q1', 'q2', 'q3', 'q4'];
    for (const q of questions) {
      results.questions[q] = {
        A: parseInt(totals[`${q}:A`] || '0'),
        B: parseInt(totals[`${q}:B`] || '0'),
        draw: parseInt(totals[`${q}:draw`] || '0'),
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Results error:', error);
    return NextResponse.json({ error: '集計の取得に失敗しました' }, { status: 500 });
  }
}
