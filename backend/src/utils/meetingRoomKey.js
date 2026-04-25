/**
 * Meeting / room id used everywhere must be the same string:
 * - Socket.IO `join(meetingId)` and `stream-audio` payload
 * - Redis list key for buffered transcript segments
 * - Mongo TranscriptSegment / TranscriptDocument `meetingId`
 * - POST /transcript/generate-context-summary body
 *
 * The client uses `window.location.href` (full URL), which contains ":" — so Redis keys
 * must not be parsed by splitting on ":".
 */

export const TRANSCRIPT_BUFFER_PREFIX = "transcripts:buffer:";

/** Redis key for the transcript backlog list for one room. */
export function transcriptBufferKey(meetingId) {
  if (meetingId == null || meetingId === "") return null;
  return `${TRANSCRIPT_BUFFER_PREFIX}${String(meetingId)}`;
}

/** Recover meeting id from a Redis key (inverse of {@link transcriptBufferKey}). */
export function meetingIdFromTranscriptBufferKey(redisKey) {
  if (!redisKey || typeof redisKey !== "string") return null;
  if (!redisKey.startsWith(TRANSCRIPT_BUFFER_PREFIX)) return null;
  return redisKey.slice(TRANSCRIPT_BUFFER_PREFIX.length);
}
