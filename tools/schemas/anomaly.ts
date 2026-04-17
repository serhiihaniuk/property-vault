import { z } from 'zod';

export const AnomalySeverity = z.enum(['info', 'notice', 'warning', 'alert']);

export const AnomalyStatus = z.enum(['open', 'acknowledged', 'resolved']);

export const AnomalySchema = z.object({
  rule_id: z.string(),
  severity: AnomalySeverity,
  subject_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  payload_signature: z.string(),
  payload_json: z.record(z.unknown()),
  status: AnomalyStatus.default('open'),
  detected_at: z.string().datetime(),
  resolved_at: z.string().datetime().nullable().default(null),
});

export type Anomaly = z.infer<typeof AnomalySchema>;
