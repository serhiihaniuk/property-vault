import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { getAppConfigPaths, readJsonFile } from './app-config.ts';

export const LOCATOR_SENDERS = [
  'ksiegowosc4@locator.wroclaw.pl',
  'administrator4@locator.wroclaw.pl',
];

export type GmailMessageRef = {
  id: string;
  threadId: string;
};

export type ListMessagesOptions = {
  query: string;
  maxResults?: number;
};

export type LocatorQueryOptions = {
  after?: string;
};

export type GmailAttachmentPart = {
  partId: string | null;
  filename: string;
  mimeType: string | null;
  attachmentId: string | null;
  size: number | null;
};

export type GmailMessageWithAttachments = {
  id: string;
  threadId: string;
  historyId: string | null;
  internalDate: string | null;
  headers: Record<string, string>;
  subject: string | null;
  from: string | null;
  to: string | null;
  date: string | null;
  bodyText: string;
  attachments: GmailAttachmentPart[];
};

type GoogleOAuthCredentials = {
  installed?: OAuthClientConfig;
  web?: OAuthClientConfig;
};

type OAuthClientConfig = {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
};

type GmailService = ReturnType<typeof google.gmail>;

type GmailPayloadPart = {
  partId?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  headers?: Array<{ name?: string | null; value?: string | null }> | null;
  body?: {
    attachmentId?: string | null;
    data?: string | null;
    size?: number | null;
  } | null;
  parts?: GmailPayloadPart[] | null;
};

type GmailApiMessage = {
  id?: string | null;
  threadId?: string | null;
  historyId?: string | null;
  internalDate?: string | null;
  payload?: GmailPayloadPart | null;
};

export async function getAuthenticatedGmailService(): Promise<GmailService> {
  const paths = getAppConfigPaths();
  const credentials = await readJsonFile<GoogleOAuthCredentials>(paths.credentialsJson);
  const token = await readJsonFile<Record<string, unknown>>(paths.gmailTokenJson);
  const clientConfig = credentials.installed ?? credentials.web;

  if (!clientConfig) {
    throw new Error(`Expected installed or web OAuth credentials in ${paths.credentialsJson}`);
  }

  const client = new OAuth2Client({
    clientId: clientConfig.client_id,
    clientSecret: clientConfig.client_secret,
    redirectUri: clientConfig.redirect_uris?.[0],
  });
  client.setCredentials(token);

  return google.gmail({ version: 'v1', auth: client });
}

export async function listMessages(
  opts: ListMessagesOptions,
  service?: GmailService,
): Promise<GmailMessageRef[]> {
  const gmail = service ?? await getAuthenticatedGmailService();
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: opts.query,
    maxResults: opts.maxResults,
  });

  return (response.data.messages ?? [])
    .filter((message): message is { id: string; threadId: string } =>
      typeof message.id === 'string' && typeof message.threadId === 'string',
    )
    .map((message) => ({
      id: message.id,
      threadId: message.threadId,
    }));
}

export async function listLocatorMessages(
  opts: { maxResults?: number; after?: string } = {},
  service?: GmailService,
): Promise<GmailMessageRef[]> {
  return listMessages({
    query: buildLocatorQuery({ after: opts.after }),
    maxResults: opts.maxResults,
  }, service);
}

export async function getMessage(
  gmailId: string,
  service?: GmailService,
): Promise<GmailMessageWithAttachments> {
  const gmail = service ?? await getAuthenticatedGmailService();
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: gmailId,
    format: 'full',
  });

  return parseGmailMessage(response.data as GmailApiMessage);
}

export async function fetchAttachmentBytes(
  gmailId: string,
  attachmentId: string,
  service?: GmailService,
): Promise<Buffer> {
  const gmail = service ?? await getAuthenticatedGmailService();
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: gmailId,
    id: attachmentId,
  });
  const data = response.data.data;

  if (typeof data !== 'string') {
    throw new Error(`Attachment ${attachmentId} for message ${gmailId} has no data`);
  }

  return decodeBase64Url(data);
}

export function buildLocatorQuery(opts: LocatorQueryOptions = {}): string {
  const senderQuery = `from:(${LOCATOR_SENDERS.join(' OR ')})`;

  if (!opts.after) {
    return senderQuery;
  }

  return `${senderQuery} after:${formatGmailDate(opts.after)}`;
}

export function parseGmailMessage(message: GmailApiMessage): GmailMessageWithAttachments {
  const payload = message.payload ?? {};
  const headers = headersToRecord(payload.headers ?? []);
  const bodyText = collectPlainText(payload).join('\n\n').trim();
  const attachments = collectAttachments(payload);

  return {
    id: requireString(message.id, 'message.id'),
    threadId: requireString(message.threadId, 'message.threadId'),
    historyId: message.historyId ?? null,
    internalDate: message.internalDate ?? null,
    headers,
    subject: headers.subject ?? null,
    from: headers.from ?? null,
    to: headers.to ?? null,
    date: headers.date ?? null,
    bodyText,
    attachments,
  };
}

export function collectAttachments(payload: GmailPayloadPart): GmailAttachmentPart[] {
  const attachments: GmailAttachmentPart[] = [];
  const stack = [payload];

  while (stack.length > 0) {
    const part = stack.shift();
    if (!part) {
      continue;
    }

    if (part.parts) {
      stack.push(...part.parts);
    }

    const filename = part.filename?.trim() ?? '';
    const attachmentId = part.body?.attachmentId ?? null;

    if (filename !== '' || attachmentId) {
      attachments.push({
        partId: part.partId ?? null,
        filename,
        mimeType: part.mimeType ?? null,
        attachmentId,
        size: part.body?.size ?? null,
      });
    }
  }

  return attachments;
}

export function collectPlainText(payload: GmailPayloadPart): string[] {
  const texts: string[] = [];
  const stack = [payload];

  while (stack.length > 0) {
    const part = stack.shift();
    if (!part) {
      continue;
    }

    if (part.parts) {
      stack.push(...part.parts);
    }

    if (part.mimeType === 'text/plain' && part.body?.data) {
      texts.push(decodeBase64Url(part.body.data).toString('utf8').trim());
    }
  }

  return texts.filter((text) => text !== '');
}

export function decodeBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
  return Buffer.from(padded, 'base64');
}

function headersToRecord(
  headers: Array<{ name?: string | null; value?: string | null }>,
): Record<string, string> {
  const record: Record<string, string> = {};

  for (const header of headers) {
    if (typeof header.name === 'string' && typeof header.value === 'string') {
      record[header.name.toLowerCase()] = header.value;
    }
  }

  return record;
}

function formatGmailDate(value: string): string {
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replace(/-/g, '/');
  }

  throw new Error(`Gmail date must be YYYY-MM-DD or YYYY/MM/DD: ${value}`);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing ${label}`);
  }

  return value;
}
