import { mcpClientManager } from '../mcp-client.js';

export async function finalizeSignin({
  sessionId,
  clientIp,
  retailerId,
  signinId,
}: {
  sessionId: string;
  clientIp: string;
  retailerId: string;
  signinId: string;
}) {
  const mcpClient = await mcpClientManager.get({
    sessionId,
    clientIp,
    retailerId,
  });

  await mcpClient.callTool({
    name: 'finalize_signin',
    arguments: { signin_id: signinId },
  });
}
