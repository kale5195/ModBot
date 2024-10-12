-- CreateTable
CREATE TABLE "ChannelOrder" (
    "id" TEXT NOT NULL,
    "fid" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "txHash" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ChannelOrder_pkey" PRIMARY KEY ("id")
);
