import path from "path";
import { fileURLToPath } from "url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { createClient as createRedisClient } from "redis";
import { transcriptBufferKey } from "../utils/meetingRoomKey.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend-local proto to avoid cross-service path coupling on Render.
const PROTO_PATH = path.join(__dirname, "..", "proto", "asr.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition).asr;

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
  const client = new proto.ASR(grpcAddress, grpc.credentials.createInsecure());
  console.log("Created gRPC client for ASR service");
  await initRedis();

  const audioNs = io.of("/audio");

  audioNs.on("connection", (socket) => {
    console.log("Audio namespace connection:", socket.id);

    try {
      console.log("Socket handshake query:", socket.handshake.query);
    } catch (e) {}

    let grpcCall = null;
    let segmentSequence = 0;
    let nonPcmWarned = false;

    function attachStreamHandlers(call) {
      call.on("data", async (segment) => {
        try {
          const meetingId = socket.meetingId || "unknown";
          const text = segment.sentence || "";
          console.log(`📥 Received from ASR -> text=${JSON.stringify(text)} meetingId=${meetingId}`);
          const payload = {
            meetingId,
            startTs: segment.start_ts,
            endTs: segment.end_ts,
            text,
            sequence: segmentSequence++,
            speakerId: socket.speakerId || "",
          };
          if (meetingId !== "unknown") {
            audioNs.to(meetingId).emit("new-transcript", payload);
            console.log(`🛰️ Broadcasted -> meeting=${meetingId} text=${JSON.stringify(text)} startTs=${payload.startTs} endTs=${payload.endTs}`);
          } else {
            console.warn("⚠️ meetingId unknown, transcript not broadcast");
          }

          const key = transcriptBufferKey(meetingId);
          const segmentJson = JSON.stringify(payload);
          const pushedCount = await redisClient.rPush(key, segmentJson);
          console.log(`💾 Pushed segment -> Redis key=${key} (list length after push=${pushedCount})`);
        } catch (err) {
          console.error("Error handling transcript segment:", err);
        }
      });

      call.on("metadata", (meta) => {
        try {
          console.log("🧾 gRPC metadata:", meta.getMap ? meta.getMap() : meta);
        } catch (e) {}
      });

      call.on("status", (status) => {
        console.log("gRPC stream status for socket", socket.id, status);
      });

      call.on("end", () => {
        console.log("gRPC stream ended by server for socket", socket.id);
        if (grpcCall === call) grpcCall = null;
      });

      call.on("error", (err) => {
        console.error("gRPC stream error:", err);
        if (grpcCall === call) grpcCall = null;
      });
    }

    function ensureGrpcStream() {
      if (grpcCall) return;
      grpcCall = client.StreamAudio();
      attachStreamHandlers(grpcCall);
      console.log("Opened new gRPC client stream for socket", socket.id);
    }

    socket.on("join", (meetingId) => {
      socket.join(meetingId);
      socket.meetingId = meetingId;
      console.log(`Socket ${socket.id} joined audio room ${meetingId}`);
      try {
        ensureGrpcStream();
        console.log("gRPC stream opened after join (ready for PCM)");
      } catch (err) {
        console.error("Failed to open gRPC stream on join:", err);
      }
    });

    socket.on("stream-audio", (payload) => {
      const encoding = payload.encoding || "(unknown)";
      const data = payload.data ? (Buffer.isBuffer(payload.data) ? payload.data : Buffer.from(payload.data)) : Buffer.alloc(0);
      const len = data.length;

      // Explicit PCM only, or small even-sized chunks (typical 100ms PCM ~3200 bytes) — never treat large WebM as PCM
      let acceptAsPcm =
        encoding === "pcm_16k_16bit_mono" ||
        (encoding === "(unknown)" && len % 2 === 0 && len >= 320 && len <= 8192);

      if (!acceptAsPcm) {
        if (!nonPcmWarned) {
          console.warn(
            `⚠️ Ignoring audio (encoding="${encoding}", size=${len}). Send pcm_16k_16bit_mono from frontend.`
          );
          nonPcmWarned = true;
        }
        return;
      }

      if (encoding === "(unknown)" && !nonPcmWarned) {
        console.warn("⚠️ No encoding field; treating as PCM (add encoding: pcm_16k_16bit_mono on frontend).");
        nonPcmWarned = true;
      }

      try {
        ensureGrpcStream();
        if (payload.speakerId) socket.speakerId = payload.speakerId;
        grpcCall.write({ audio_chunk: data });
      } catch (err) {
        console.error("Failed to write stream-audio to gRPC:", err);
      }
    });

    socket.on("end-audio", () => {
      try {
        if (grpcCall) {
          grpcCall.end();
          grpcCall = null;
          console.log("Closed gRPC stream for socket (end-audio)", socket.id);
        }
      } catch (err) {
        console.error("Error ending gRPC stream:", err);
      }
    });

    socket.on("disconnect", () => {
      try {
        if (grpcCall) {
          grpcCall.end();
          grpcCall = null;
        }
      } catch (err) {}
      console.log("Audio socket disconnected:", socket.id);
    });
  });

  return audioNs;
}
