export async function POST(request) {
  try {
    const payload = await request.json();
    console.error('[client-error]', {
      received_at: new Date().toISOString(),
      user_agent: request.headers.get('user-agent'),
      ...payload,
    });
  } catch (error) {
    console.error('[client-error] failed to parse payload', error);
  }

  return Response.json({ ok: true });
}
