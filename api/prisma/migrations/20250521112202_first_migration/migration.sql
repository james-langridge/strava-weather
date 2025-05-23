-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "stravaAthleteId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "weatherEnabled" BOOLEAN NOT NULL DEFAULT true,
    "firstName" TEXT,
    "lastName" TEXT,
    "profileImageUrl" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stravaActivityId" INTEGER NOT NULL,
    "weatherAdded" BOOLEAN NOT NULL DEFAULT false,
    "weatherData" TEXT,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_processing" (
    "id" TEXT NOT NULL,
    "stravaActivityId" INTEGER NOT NULL,
    "stravaAthleteId" INTEGER NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorDetails" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_processing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "temperatureUnit" TEXT NOT NULL DEFAULT 'fahrenheit',
    "weatherFormat" TEXT NOT NULL DEFAULT 'detailed',
    "includeUvIndex" BOOLEAN NOT NULL DEFAULT false,
    "includeVisibility" BOOLEAN NOT NULL DEFAULT false,
    "customFormat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_stravaAthleteId_key" ON "users"("stravaAthleteId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_stravaActivityId_idx" ON "activity_logs"("stravaActivityId");

-- CreateIndex
CREATE INDEX "activity_logs_processedAt_idx" ON "activity_logs"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "activity_logs_userId_stravaActivityId_key" ON "activity_logs"("userId", "stravaActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_subscriptions_subscriptionId_key" ON "webhook_subscriptions"("subscriptionId");

-- CreateIndex
CREATE INDEX "failed_processing_stravaAthleteId_idx" ON "failed_processing"("stravaAthleteId");

-- CreateIndex
CREATE INDEX "failed_processing_resolved_idx" ON "failed_processing"("resolved");

-- CreateIndex
CREATE INDEX "failed_processing_lastAttemptAt_idx" ON "failed_processing"("lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
