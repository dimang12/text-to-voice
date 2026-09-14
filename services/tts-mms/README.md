# tts-mms

Self-hosted Khmer text-to-speech using Meta's MMS-TTS (`facebook/mms-tts-khm`). Runs on CPU, no GPU needed.

```bash
docker build -t voice-studio-mms services/tts-mms
docker run -p 8020:8000 voice-studio-mms
curl -X POST localhost:8020/synthesize -H 'Content-Type: application/json' \
  -d '{"text":"សួស្តី! នេះជាការសាកល្បង។","lang":"khm","format":"mp3"}' -o hello.mp3
```

Set `MMS_TTS_URL=http://localhost:8020` in `.env.local` so the app can reach it. Add more languages with `MMS_LANGS=khm,eng` at build and run time.

## License

The MMS models are released by Meta under **CC BY-NC 4.0**, which does not permit commercial use. Use this service for evaluation, internal, or non-commercial deployments. For a paid product use a commercially licensed Khmer voice (for example Azure Speech) or train your own with Piper on a permissively licensed dataset such as OpenSLR 42.

## Notes

- Text is split on Khmer and Latin sentence marks, synthesised per sentence, and joined with a short pause.
- Numbers and Latin words should be written out in Khmer script; the model skips characters it does not know.
- `speed` maps to the model's speaking rate (0.5 to 2.0).
