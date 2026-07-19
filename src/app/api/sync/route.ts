// File deprecated in favor of WebSocket on Render
export function GET() {
  return new Response("Deprecated", { status: 410 });
}
