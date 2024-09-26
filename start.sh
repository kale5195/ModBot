#!/bin/sh -ex

pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec prisma db seed
pnpm run start