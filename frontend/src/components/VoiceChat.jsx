import { useState, useRef } from "react";

const MicIcon = ({ size = 20, active = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={active ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const StopIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const SpeakerIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a7 7 0 0 1 0 9.9M18.7 5.3a11 11 0 0 1 0 15.4" />
  </svg>
);

export default function VoiceChat({ onVoiceMessage }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        // Send to backend for transcription
        onVoiceMessage(audioBlob);
        setTranscript("Voice message sent...");
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = (audioUrl) => {
    setIsPlaying(true);
    const audio = new Audio(audioUrl);
    audio.onended = () => setIsPlaying(false);
    audio.play();
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "#f3f4f6",
        borderRadius: 8,
      }}
    >
      <button
        onClick={isRecording ? stopRecording : startRecording}
        style={{
          background: isRecording ? "#ef4444" : "#ff6b35",
          border: "none",
          borderRadius: "50%",
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#ffffff",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        {isRecording ? <StopIcon size={18} /> : <MicIcon size={18} />}
      </button>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            color: "#0d0d0d",
            fontWeight: 500,
          }}
        >
          {isRecording ? "Recording..." : "Ready to record"}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 2,
          }}
        >
          {transcript || "Click to start voice chat"}
        </div>
      </div>
    </div>
  );
}

// Voice message player component
export function VoiceMessagePlayer({ audioUrl, onPlay }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
    const audio = new Audio(audioUrl);
    audio.onended = () => setIsPlaying(false);
    audio.play();
    onPlay?.();
  };

  return (
    <button
      onClick={handlePlay}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: isPlaying ? "#ff6b35" : "#f3f4f6",
        border: "1px solid #d1d5db",
        borderRadius: 6,
        cursor: "pointer",
        color: isPlaying ? "#ffffff" : "#0d0d0d",
        fontSize: 12,
        fontWeight: 500,
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!isPlaying) {
          e.currentTarget.style.background = "#ececf1";
        }
      }}
      onMouseLeave={(e) => {
        if (!isPlaying) {
          e.currentTarget.style.background = "#f3f4f6";
        }
      }}
    >
      <SpeakerIcon size={14} />
      {isPlaying ? "Playing..." : "Listen"}
    </button>
  );
}
