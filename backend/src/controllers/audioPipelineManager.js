import path from "path";
import { fileURLToPath } from "url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { createClient as createRedisClient } from "redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// proto lives at workspace_root/microservices/dummy-asr/proto/transcription.proto
const PROTO_PATH = path.join(__dirname, "..", "..", "..", "..", "microservices", "dummy-asr", "proto", "transcription.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition).transcription;

let redisClient;

async function initRedis() {
  if (!redisClient) {
    redisClient = createRedisClient();
    redisClient.on("error", (err) => console.error("Redis Client Error", err));
    await redisClient.connect();
    console.log("Redis client connected for audio pipeline");
  }
  return redisClient;
}

export async function attachAudioPipeline(io, opts = {}) {
  const grpcAddress = opts.grpcAddress || process.env.ASR_GRPC_ADDR || "localhost:50051";
  console.log(`Audio pipeline will connect to gRPC ASR at ${grpcAddress}`);
  const client = new proto.Transcription(grpcAddress, grpc.credentials.createInsecure());
  console.log("Created gRPC client for Transcription service");
  await initRedis();

  // Use a namespaced socket to keep audio concerns separate
  const audioNs = io.of("/audio");

  audioNs.on("connection", (socket) => {
    console.log("Audio namespace connection:", socket.id);

    // show socket rooms / handshake info
    try {
      console.log("Socket handshake query:", socket.handshake.query);
    } catch (e) {}

    let grpcCall = client.StreamAudio();
    console.log("Opened new gRPC client stream for socket", socket.id);

    grpcCall.on("data", async (segment) => {
      try {
        // segment fields come as plain JS objects; broadcast to meeting room
        const meetingId = segment.meetingId || socket.meetingId;
        if (meetingId) {
          audioNs.to(meetingId).emit("new-transcript", segment);
          console.log(`🛰️ Broadcasted segment -> meeting=${meetingId} seq=${segment.sequence} start=${segment.startTs}s end=${segment.endTs}s speaker=${segment.speakerId}`);
          console.log("📝 Segment preview:", (segment.text || "").slice(0, 200));
        }

        // push into redis buffer list
        const key = `transcripts:buffer:${segment.meetingId || "unknown"}`;
        const segmentJson = JSON.stringify(segment);
        const pushedCount = await redisClient.rPush(key, segmentJson);
        console.log(`💾 Pushed segment -> Redis key=${key} (list length after push=${pushedCount})`);
        console.log("🔍 Segment JSON saved to Redis:", segmentJson);
      } catch (err) {
        console.error("Error handling transcript segment:", err);
      }
    });

    grpcCall.on("metadata", (meta) => {
      try {
        console.log("🧾 gRPC metadata:", meta.getMap ? meta.getMap() : meta);
      } catch (e) {}
    });

    grpcCall.on("status", (status) => {
      console.log("gRPC stream status for socket", socket.id, status);
    });

    grpcCall.on("end", () => {
      console.log("gRPC stream ended by server for socket", socket.id);
    });

    grpcCall.on("error", (err) => {
      console.error("gRPC stream error:", err);
    });

    socket.on("join", (meetingId) => {
      socket.join(meetingId);
      socket.meetingId = meetingId;
      console.log(`Socket ${socket.id} joined audio room ${meetingId}`);
    });

    // Expect payload: { data: Uint8Array|Buffer, timestamp, meetingId, speakerId, seq }
    socket.on("stream-audio", (payload) => {
      console.log(`🎧 Received stream-audio from socket=${socket.id} seq=${payload.seq} meeting=${payload.meetingId} speaker=${payload.speakerId}`);
      try {
        const chunk = {
          data: payload.data || Buffer.from([]),
          timestamp: payload.timestamp || Date.now(),
          meetingId: payload.meetingId || socket.meetingId || "",
          speakerId: payload.speakerId || "",
          seq: payload.seq || 0
        };
        // show chunk size and write to gRPC stream
        const size = chunk.data ? (chunk.data.length || (chunk.data.byteLength ? chunk.data.byteLength : 0)) : 0;
        console.log(`⬆️ Sending chunk -> meeting=${chunk.meetingId} seq=${chunk.seq} size=${size} bytes speaker=${chunk.speakerId}`);
        grpcCall.write(chunk);
        console.log(`✅ Wrote chunk to gRPC for socket=${socket.id} seq=${chunk.seq}`);
      } catch (err) {
        console.error("Failed to write audio chunk to gRPC:", err);
      }
    });

    socket.on("end-audio", () => {
      try {
        grpcCall.end();
      } catch (err) {
        console.error("Error ending gRPC stream:", err);
      }
    });

    socket.on("disconnect", () => {
      try {
        grpcCall.end();
      } catch (err) {}
      console.log("Audio socket disconnected:", socket.id);
    });
  });

  return audioNs;
}

