import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound } from '../../core/errors.js';
import { rateLimit } from '../../core/rateLimit.js';
import { query } from '../../db/pool.js';
import { requireAuth } from '../../plugins/auth.js';
import { registry } from '../questions/engine/registry.js';
import { answerQuestion, getAttemptReview, startAttempt, submitAttempt } from './attempts.js';

const startSchema = z.object({
  mode: z
    .enum(['practice', 'timed', 'daily', 'challenge', 'competitive', 'random', 'category', 'difficulty'])
    .default('practice'),
  categoryId: z.string().uuid().nullish(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).nullish(),
  language: z.enum(['ar', 'en']).nullish(),
  questionCount: z.number().int().min(1).max(100).optional(),
  types: z.array(z.string()).max(20).optional(),
});

export async function quizRoutes(app: FastifyInstance): Promise<void> {
  const startLimiter = rateLimit({ max: 20, keyPrefix: 'quiz-start' });
  const answerLimiter = rateLimit({ max: 300, keyPrefix: 'quiz-answer' });

  /** Supported question types (for clients & admin editors). */
  app.get('/question-types', async () => ({
    types: registry.listTypes().map((t) => ({
      id: t.id,
      family: t.family,
      scored: t.scored,
      manualReview: t.manualReview,
      media: t.media,
    })),
  }));

  app.post('/start', { preHandler: [requireAuth, startLimiter] }, async (req) => {
    const parsed = startSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest('Invalid quiz options', parsed.error.issues);
    const opts = parsed.data;
    if (opts.mode === 'daily') {
      // daily quiz: deterministic per-day random selection, competitive scope
      return startAttempt(req.userId!, req.isGuest, {
        ...opts,
        mode: 'daily',
        contextType: 'daily',
        questionCount: opts.questionCount ?? 10,
      });
    }
    return startAttempt(req.userId!, req.isGuest, opts);
  });

  app.post('/attempts/:id/answers', { preHandler: [requireAuth, answerLimiter] }, async (req) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ questionId: z.string().uuid(), answer: z.unknown() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid answer payload', parsed.error.issues);
    return answerQuestion(id, req.userId!, parsed.data.questionId, parsed.data.answer);
  });

  app.post('/attempts/:id/submit', { preHandler: [requireAuth] }, async (req) => {
    const { id } = req.params as { id: string };
    return submitAttempt(id, req.userId!);
  });

  app.get('/attempts/:id/review', { preHandler: [requireAuth] }, async (req) => {
    const { id } = req.params as { id: string };
    return getAttemptReview(id, req.userId!);
  });

  /** Resume data for an in-progress attempt (network-recovery support). */
  app.get('/attempts/:id', { preHandler: [requireAuth] }, async (req) => {
    const { id } = req.params as { id: string };
    const { rows } = await query(
      `SELECT a.id, a.status, a.mode, a.question_ids, a.question_meta, a.started_at, a.deadline_at,
              a.score, a.max_score
       FROM attempts a WHERE a.id = $1 AND a.user_id = $2`,
      [id, req.userId],
    );
    const a = rows[0];
    if (!a) throw notFound('Attempt not found');
    const answered = await query('SELECT question_id, outcome, score FROM attempt_answers WHERE attempt_id = $1', [id]);
    return {
      attempt: {
        id: a.id,
        status: a.status,
        mode: a.mode,
        questionIds: a.question_ids,
        startedAt: a.started_at,
        deadlineAt: a.deadline_at,
        score: a.score,
        maxScore: a.max_score,
      },
      answered: answered.rows.map((r) => ({ questionId: r.question_id, outcome: r.outcome, score: r.score })),
    };
  });

  /** Recent results for the current user. */
  app.get('/attempts', { preHandler: [requireAuth] }, async (req) => {
    const q = req.query as { limit?: string; offset?: string };
    const limit = Math.min(Number(q.limit ?? 20), 100);
    const offset = Math.max(Number(q.offset ?? 0), 0);
    const { rows } = await query(
      `SELECT id, mode, context_type, status, score, max_score, correct_count, incorrect_count,
              timeout_count, skipped_count, started_at, submitted_at, server_duration_ms
       FROM attempts WHERE user_id = $1 AND status <> 'in_progress'
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset],
    );
    return { attempts: rows };
  });
}
