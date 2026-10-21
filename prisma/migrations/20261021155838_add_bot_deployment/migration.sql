-- CreateTable
CREATE TABLE "BotDeployment" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotDeployment_deployedAt_idx" ON "BotDeployment"("deployedAt");
