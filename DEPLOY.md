# Deploying Voice Studio

The app is a single Docker image. Supabase (database, auth, storage) runs beside it. Two proven layouts on AWS are described below. Pick one when you're ready; the app code does not change.

## Local development

```bash
npm run db:start      # starts Postgres, Auth, Storage, Studio in Docker and applies supabase/migrations
npm run db:env        # prints the local URL and keys
npm run dev
```

Local Studio UI: http://localhost:54323. Emails (confirmation, magic links) are caught at http://localhost:54324 instead of being sent.

Put the values from `npm run db:env` into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from db:env>
```

Run the app itself in Docker if you want to test the production image:

```bash
docker compose --env-file .env.local build
docker compose --env-file .env.local up -d
```

Note: inside the container `127.0.0.1` refers to the container, so for this test set `NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321`.

## Option A: app on AWS, Supabase hosted (least ops)

1. Create a project at supabase.com, run `npm run db:migrate` after `npx supabase link --project-ref <ref>`.
2. Build and push the image to ECR:
   ```bash
   aws ecr create-repository --repository-name voice-studio
   docker build -t voice-studio \
     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> \
     --build-arg NEXT_PUBLIC_SITE_URL=https://voice.yourdomain.com .
   docker tag voice-studio:latest <account>.dkr.ecr.<region>.amazonaws.com/voice-studio:latest
   docker push <account>.dkr.ecr.<region>.amazonaws.com/voice-studio:latest
   ```
3. Run it on ECS Fargate (one service, one task, port 3000) behind an Application Load Balancer with an ACM certificate. Store `OPENAI_API_KEY` in Secrets Manager and inject it as a task secret.
4. In Supabase Authentication → URL Configuration set Site URL to `https://voice.yourdomain.com` and add `https://voice.yourdomain.com/auth/callback` to redirect URLs.

## Option B: everything self-hosted on one EC2 instance

Good for a first launch or when data must stay in your account.

1. Launch an EC2 instance (t3.medium or larger, 40 GB disk, Ubuntu 24.04). Install Docker and the Compose plugin.
2. Self-host Supabase with its official compose file:
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   cp -r supabase/docker ~/supabase && cd ~/supabase
   cp .env.example .env
   ```
   Edit `.env`: set `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SITE_URL=https://voice.yourdomain.com`, `API_EXTERNAL_URL=https://api.yourdomain.com`, and SMTP settings for real emails. Then `docker compose up -d`.
3. Apply this repo's migration to that database:
   ```bash
   npx supabase db push --db-url "postgresql://postgres:<password>@<ec2-host>:5432/postgres"
   ```
4. Copy this repo to the instance, create `.env` with the four variables from `.env.example` pointing at `https://api.yourdomain.com`, then `docker compose build && docker compose up -d`.
5. Put Caddy or nginx in front for TLS: `voice.yourdomain.com` → `localhost:3000`, `api.yourdomain.com` → Supabase Kong on `localhost:8000`.
6. Back up Postgres nightly (`pg_dump` to S3) and snapshot the storage volume.

## Self-hosted Khmer engine

`services/tts-mms` is a small FastAPI container running Meta's MMS Khmer voice on CPU. `docker compose up` starts it beside the app on port 8020; set `MMS_TTS_URL` so the app can reach it. It needs about 1.5 GB RAM and no GPU, so a t3.medium is enough for light use.

**License:** the MMS models are CC BY-NC 4.0, non-commercial only. Keep it for evaluation or free use, and switch to a commercially licensed Khmer voice before charging users.

## Environment variables

| Variable | Where it's read | Notes |
|---|---|---|
| `OPENAI_API_KEY` | server only | Secrets Manager or `.env` |
| `NEXT_PUBLIC_SUPABASE_URL` | build and runtime | baked into the client bundle at build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build and runtime | safe to expose; RLS protects data |
| `NEXT_PUBLIC_SITE_URL` | server | used for OAuth and email redirect links |
| `MMS_TTS_URL` | server only | URL of the tts-mms container; unset hides the Khmer engine |
| `APP_SECRET` | server only | random string used to encrypt user API keys; changing it invalidates stored keys |

Because the `NEXT_PUBLIC_*` values are baked in at build time, rebuild the image when they change.
