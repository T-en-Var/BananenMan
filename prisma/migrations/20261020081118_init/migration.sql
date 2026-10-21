-- CreateEnum
CREATE TYPE "XpSource" AS ENUM ('VOICE_MINUTE', 'TEXT_MESSAGE');

-- CreateTable
CREATE TABLE "LegacyXpImport" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "textXp" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "voiceXp" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyXpImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" BIGSERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "XpSource" NOT NULL,
    "amount" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "channelId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegacyXpImport_guildId_userId_key" ON "LegacyXpImport"("guildId", "userId");

-- CreateIndex
CREATE INDEX "XpEvent_guildId_userId_idx" ON "XpEvent"("guildId", "userId");

-- CreateIndex
CREATE INDEX "XpEvent_guildId_occurredAt_idx" ON "XpEvent"("guildId", "occurredAt");
