#!/usr/bin/env python3
"""
Transcribe an audio file using faster-whisper and print JSON to stdout.

Usage:
  python3 faster-whisper-transcribe.py <audio_file> <model_size>

Output JSON:
  {
    "text": "full transcript",
    "duration": 45.2,
    "words": [{"word": "hello", "start": 0.0, "end": 0.28}, ...],
    "segments": [{"text": "...", "start": 0.0, "end": 5.2}, ...]
  }

Install: pip install faster-whisper
Model downloaded automatically on first run to ~/.cache/huggingface/hub/
"""
import json
import sys

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: faster-whisper-transcribe.py <audio_file> <model_size>"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    model_size = sys.argv[2]

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper not installed. Run: pip install faster-whisper"}), file=sys.stderr)
        sys.exit(1)

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments_gen, info = model.transcribe(audio_path, word_timestamps=True, beam_size=5)

    segments = []
    words = []
    for seg in segments_gen:
        segments.append({"text": seg.text.strip(), "start": seg.start, "end": seg.end})
        if seg.words:
            for w in seg.words:
                words.append({"word": w.word.strip(), "start": w.start, "end": w.end, "confidence": round(w.probability, 3)})

    text = " ".join(s["text"] for s in segments)

    print(json.dumps({
        "text": text,
        "duration": info.duration,
        "words": words,
        "segments": segments,
    }))

if __name__ == "__main__":
    main()
