import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLocatorQuery,
  collectAttachments,
  collectPlainText,
  decodeBase64Url,
  parseGmailMessage,
} from './gmail.ts';

test('buildLocatorQuery includes known senders and optional after date', () => {
  assert.equal(
    buildLocatorQuery(),
    'from:(ksiegowosc4@locator.wroclaw.pl OR administrator4@locator.wroclaw.pl)',
  );
  assert.equal(
    buildLocatorQuery({ after: '2026-04-17' }),
    'from:(ksiegowosc4@locator.wroclaw.pl OR administrator4@locator.wroclaw.pl) after:2026/04/17',
  );
  assert.throws(
    () => buildLocatorQuery({ after: '17-04-2026' }),
    /Gmail date must be/,
  );
});

test('decodeBase64Url decodes URL-safe Gmail data', () => {
  assert.equal(decodeBase64Url('SGVsbG8td29ybGQ_').toString('utf8'), 'Hello-world?');
});

test('collectPlainText and collectAttachments traverse nested MIME parts', () => {
  const payload = {
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          {
            mimeType: 'text/plain',
            body: {
              data: Buffer.from('Plain body', 'utf8').toString('base64url'),
            },
          },
          {
            mimeType: 'text/html',
            body: {
              data: Buffer.from('<p>HTML body</p>', 'utf8').toString('base64url'),
            },
          },
        ],
      },
      {
        partId: '2',
        filename: 'charges.pdf',
        mimeType: 'application/octet-stream',
        body: {
          attachmentId: 'att-1',
          size: 1234,
        },
      },
    ],
  };

  assert.deepEqual(collectPlainText(payload), ['Plain body']);
  assert.deepEqual(collectAttachments(payload), [{
    partId: '2',
    filename: 'charges.pdf',
    mimeType: 'application/octet-stream',
    attachmentId: 'att-1',
    size: 1234,
  }]);
});

test('parseGmailMessage returns headers, body, and attachments', () => {
  const message = parseGmailMessage({
    id: 'msg-1',
    threadId: 'thread-1',
    historyId: '42',
    internalDate: '1776412800000',
    payload: {
      headers: [
        { name: 'Subject', value: 'Zawiadomienie' },
        { name: 'From', value: 'ksiegowosc4@locator.wroclaw.pl' },
        { name: 'To', value: 'owner@example.com' },
        { name: 'Date', value: 'Fri, 17 Apr 2026 10:00:00 +0200' },
      ],
      parts: [
        {
          mimeType: 'text/plain',
          body: {
            data: Buffer.from('Message body', 'utf8').toString('base64url'),
          },
        },
        {
          partId: '1',
          filename: 'notice.pdf',
          mimeType: 'application/pdf',
          body: {
            attachmentId: 'attachment-1',
            size: 99,
          },
        },
      ],
    },
  });

  assert.equal(message.id, 'msg-1');
  assert.equal(message.threadId, 'thread-1');
  assert.equal(message.subject, 'Zawiadomienie');
  assert.equal(message.from, 'ksiegowosc4@locator.wroclaw.pl');
  assert.equal(message.bodyText, 'Message body');
  assert.equal(message.attachments.length, 1);
  assert.equal(message.attachments[0]?.attachmentId, 'attachment-1');
});
