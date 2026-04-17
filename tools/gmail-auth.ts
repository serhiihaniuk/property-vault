import http from 'node:http';
import { once } from 'node:events';
import { OAuth2Client } from 'google-auth-library';
import open from 'open';
import { getAppConfigPaths, readJsonFile, writeJsonFile } from './app-config.ts';

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

type GoogleDesktopCredentials = {
  installed?: {
    client_id: string;
    client_secret: string;
    auth_uri: string;
    token_uri: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    auth_uri: string;
    token_uri: string;
    redirect_uris?: string[];
  };
};

export type GmailAuthResult = {
  tokenPath: string;
  scopes: string[];
};

export async function authenticateGmail(): Promise<GmailAuthResult> {
  const paths = getAppConfigPaths();
  const credentials = await readJsonFile<GoogleDesktopCredentials>(paths.credentialsJson);
  const clientConfig = credentials.installed ?? credentials.web;

  if (!clientConfig) {
    throw new Error(`Expected installed or web OAuth credentials in ${paths.credentialsJson}`);
  }

  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not start local OAuth callback server');
  }

  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const client = new OAuth2Client({
    clientId: clientConfig.client_id,
    clientSecret: clientConfig.client_secret,
    redirectUri,
  });
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_READONLY_SCOPE],
  });
  const codePromise = waitForOAuthCode(server);

  await open(authUrl, { wait: false });
  console.log('Opened Google OAuth consent in your browser.');
  console.log(`If it did not open, visit this URL:\n${authUrl}`);

  const code = await codePromise;
  const { tokens } = await client.getToken(code);

  await writeJsonFile(paths.gmailTokenJson, tokens);

  return {
    tokenPath: paths.gmailTokenJson,
    scopes: [GMAIL_READONLY_SCOPE],
  };
}

async function waitForOAuthCode(server: http.Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.on('request', (request, response) => {
      try {
        const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');

        if (requestUrl.pathname !== '/oauth2callback') {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('Not found');
          return;
        }

        const error = requestUrl.searchParams.get('error');
        if (error) {
          response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('OAuth failed. You can close this tab.');
          reject(new Error(`OAuth failed: ${error}`));
          server.close();
          return;
        }

        const code = requestUrl.searchParams.get('code');
        if (!code) {
          response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('OAuth code missing. You can close this tab.');
          reject(new Error('OAuth callback did not include a code'));
          server.close();
          return;
        }

        response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Gmail authorization complete. You can close this tab.');
        resolve(code);
        server.close();
      } catch (error) {
        reject(error);
        server.close();
      }
    });
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  authenticateGmail().then(
    (result) => {
      console.log(`Saved Gmail token to ${result.tokenPath}`);
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
