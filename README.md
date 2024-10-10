## Overview

ModBot is a Farcaster channel moderation service. It allows channel hosts to configure rules to automatically invite members and manage their channel in teams. The code is forked from [Automod](https://github.com/jtgi/automod). Huge thanks to [@jtgi](https://warpcast.com/jtgi/) for his great work.

### Tech Stack

- **API Framework:** [Remix](https://remix.run)
- **Database:** PostgreSQL / [Prisma](https://www.prisma.io)
- **Queues:** [BullMQ](https://docs.bullmq.io/) with Redis
- **Hosting:** Anywhere that supports docker, node, or remix.

### How to add a new Rule

- Add a new rule name in [validations.server.ts](/app/rules/rules.type.ts).
- Create your rule file and implement RuleDefinition/RulesFunction in [app/rules](/app/rules).There are many examples to reference.
- Include `RuleName` and `RuleDefinition` to [validations.server.ts](/app/lib/validations.server.ts).

## Getting Started

### Local Development

```sh
git clone https://github.com/kale5195/ModBot.git
cd ModBot
pnpm install
cp .env.example .env
# Update .env with your configuration, see [.env.example](/.env.example) for instructions
pnpm run dev
```

## Costs

At time of writing:

- Powers 550 channels
- ~1 request per second.
- Processes 500k+ casts per month.

All Data APIs are usage based and highly variable. Here's a snapshot of August.
| Service | Provider | Cost | Notes |
|----------------------|-------------------------|----------------------------------------|----------------------------------------------------------------------|
| API | fly.io | $13/mo | 2 X shared-cpu-2x with 1024 MB memory |
| PostgreSQL | fly.io | $35/mo | 2 X shared-cpu-2x with 4096 MB memory (over provisioned) |
| Redis | railway.app | < $1/mo | |
| Farcaster Data | Neynar | > $100/mo (Contact Neynar) | Used for cast metadata, webhooks, feeds, frames, etc. |
| NFT Data | SimpleHash | > $100/mo (Contact SimpleHash) | Needed for 1155 token lookups and Zora Network at high concurrency. |
| Ethereum JSON Data | Alchemy/Infura/Coinbase | ~$30/mo | Most ERC20/721/1155 token lookups and Sign in With Farcaster. |
| Airstack Data | Airstack | Buy 1 Fan Token, free forever | Channel Following, FarRank, FarScore |
| Moxie Data | The Graph | < $5/mo | |
