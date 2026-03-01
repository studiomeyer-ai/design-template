import { query } from '@/lib/chatbot/db';

export async function POST(request: Request) {
  try {
    const { messageId, feedback } = await request.json();

    if (!messageId || !['positive', 'negative'].includes(feedback)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await query(
      'UPDATE chatbot_messages SET feedback = $1 WHERE id = $2',
      [feedback, messageId]
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to save feedback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
