#!/bin/sh -ex

pnpm exec prisma migrate dev --name added_job_title
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm run start