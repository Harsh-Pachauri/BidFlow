# British Auction RFQ System

A simplified RFQ (Request for Quotation) platform supporting British
Auction–style bidding: suppliers submit openly visible bids and
continuously lower their price to beat competitors, with automatic
anti-sniping time extensions and a hard forced-close ceiling.

Built for the GoComet Full Stack Intern take-home assignment.

## Tech Stack

- **Frontend:** React, Tailwind CSS, React Router, Axios, Socket.io Client
- **Backend:** Node.js, Express, Socket.io, Prisma
- **Database:** PostgreSQL
- **Auth:** JWT, login only (see Architecture Decisions below)

## Documentation

- [`docs/HLD.md`](docs/HLD.md) — architecture, core auction logic, sequence
  diagrams, API design, folder structure, timeline
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — table definitions,
  ER diagram, validation rules
- [`docs/SEED_DATA.md`](docs/SEED_DATA.md) — seeded users, passwords, and
  which RFQ demonstrates which auction state

## Getting Started

Requires Node 20+ and a PostgreSQL database (local or hosted — a hosted
instance like Neon, Supabase, or Prisma Postgres needs no local Postgres
install at all).

**Backend**

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm run prisma:migrate
npm run seed
npm run dev             # http://localhost:4000
```

**Frontend** (in a separate terminal)

```bash
cd frontend
npm install
cp .env.example .env   # defaults to http://localhost:4000, adjust if needed
npm run dev             # http://localhost:5173
```

Log in with any seeded account from
[`docs/SEED_DATA.md`](docs/SEED_DATA.md) — e.g. `buyer1@rfq-demo.com` /
`Password123!`.

**Running tests**

```bash
cd backend
npm test                # unit tests for the pure auction-rule functions
```

## Architecture Decisions

**PostgreSQL.** The domain is inherently relational — RFQs, bids, and
suppliers connected by foreign keys — and the hardest problem in this
system (safely ranking bids and extending auctions under concurrent writes)
needs transactional row-level locking (`SELECT ... FOR UPDATE`), which
Postgres provides natively.

**Prisma.** Type-safe queries and migrations for the majority of the app —
user/RFQ CRUD, read queries. One deliberate exception: the bid-placement
transaction drops to a raw `SELECT ... FOR UPDATE` inside a Prisma
interactive transaction, since Prisma's query builder has no first-class
row-locking syntax.

**Socket.io.** Live countdowns, bid updates, ranking changes, and auction
extensions all need to reach connected clients without polling. Room
support (`rfq:{id}` per auction) keeps broadcasts scoped to clients actually
viewing that auction instead of pushing every event to everyone.

**JWT, access token only, no refresh.** Chosen over server-side sessions
specifically because Socket.io needs a portable credential at handshake
time — a JWT drops into `socket.handshake.auth.token` directly, while
sharing an Express session store with a separate socket server is more
moving parts for no real benefit at this scope.

**Computed status, not a stored column.** Whether an auction is Active,
Closed, or Force Closed is a pure function of its timestamps
(`computeStatus`), evaluated fresh on every read and inside every bid
transaction — never cached in the database. This makes it structurally
impossible for a displayed status to disagree with the timestamps that
define it.

**Computed rankings, not stored.** L1/L2/L3 ranking is derived at query
time from each supplier's *active bid* — their single most recent
submission on an RFQ. Every earlier bid from the same supplier remains in
the table as immutable history (never updated or deleted), which doubles as
the auction's activity log. Ranking never touches historical bids, only the
current active one per supplier. Full schema in
[`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md).

**A monolith, not microservices.** One Express process, one Postgres
database, one React app. At this scale — a handful of RFQs, a handful of
suppliers each — splitting this into separate services would add
deployment and coordination overhead with no corresponding benefit.
