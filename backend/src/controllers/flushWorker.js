import { createClient as createRedisClient } from "redis";
import { TranscriptSegment } from "../models/transcriptSegment.js";
import { TranscriptDocument } from "../models/transcriptDocument.js";

let redisClient;

async function initRedis() {
  if (!redisClient) {
    redisClient = createRedisClient();
    redisClient.on("error", (err) => console.error("Redis Client Error (flushWorker)", err));
    await redisClient.connect();
    console.log("Redis client connected for flush worker");
  }
  return redisClient;
}

export async function startFlushWorker(opts = {}) {
  const intervalMs = opts.intervalMs || 30_000; // default flush every 30s
  await initRedis();

  console.log(`Starting flush worker (interval=${intervalMs}ms)`);

  async function flushOnce() {
    try {
      const keys = await redisClient.keys("transcripts:buffer:*");
      if (!keys || keys.length === 0) {
        // nothing to do
        // console.log("Flush worker: no keys to process");
        return;
      }
      console.log(`🕵️ Flush worker found ${keys.length} buffer key(s):`, keys);

      for (const key of keys) {
        try {
          const items = await redisClient.lRange(key, 0, -1);
          if (!items || items.length === 0) {
            continue;
          }
          console.log(`📦 Processing ${items.length} buffered item(s) from ${key}`);

          const docs = items.map((s) => {
            try {
              const obj = JSON.parse(s);
              return {
                meetingId: obj.meetingId || null,
                sequence: obj.sequence || 0,
                startTs: obj.startTs || 0,
                endTs: obj.endTs || 0,
                text: obj.text || "",
                speakerId: obj.speakerId || null,
                confidence: obj.confidence || null,
                isFinal: obj.isFinal !== undefined ? obj.isFinal : true,
                createdAt: new Date()
              };
            } catch (err) {
              console.error("Failed to parse buffered segment JSON", err);
              return null;
            }
          }).filter(Boolean);

          if (docs.length === 0) {
            await redisClient.del(key);
            continue;
          }

          // Bulk insert segments (ignore duplicate sequence errors)
          let insertResult = [];
          try {
            insertResult = await TranscriptSegment.insertMany(docs, { ordered: false });
          } catch (err) {
            console.warn("⚠️ insertMany warnings/errors:", err.message || err);
            // if err has insertedDocs (MongoBulkWriteError), try to extract them
            insertResult = err && err.insertedDocs ? err.insertedDocs : [];
          }

          const insertedArray = Array.isArray(insertResult) ? insertResult : [];
          const insertedIds = insertedArray.map(d => d._id).filter(Boolean);
          console.log(`✅ Inserted ${insertedIds.length} transcript segments into Mongo for key=${key}`);
          // Log previews of inserted segments
          insertedArray.slice(0, 5).forEach((doc) => {
            try {
              console.log(`   - inserted segment seq=${doc.sequence} meeting=${doc.meetingId} textPreview="${(doc.text || '').slice(0,120)}"`);
            } catch (e) {}
          });

          // Map key -> meetingId
          // key format: transcripts:buffer:{meetingId}
          const parts = key.split(":");
          const meetingId = parts.slice(2).join(":") || null;

          if (meetingId && insertedIds.length > 0) {
            const td = await TranscriptDocument.findOneAndUpdate(
              { meetingId },
              { $push: { segments: { $each: insertedIds } }, $set: { lastFlushedAt: new Date() }, $inc: { version: 1 } },
              { upsert: true, new: true }
            );
            console.log(`📄 Updated TranscriptDocument for meeting=${meetingId} id=${td?._id}`);
          }

          // remove the processed key from redis
          await redisClient.del(key);
          console.log(`🗑️ Deleted Redis key ${key} after flush`);
        } catch (innerErr) {
          console.error("Error processing key in flush worker:", innerErr);
        }
      }
    } catch (err) {
      console.error("Flush worker error:", err);
    }
  }

  // Start periodic flush
  const timer = setInterval(flushOnce, intervalMs);

  return {
    stop: () => {
      clearInterval(timer);
      console.log("Flush worker stopped");
    }
  };
}

