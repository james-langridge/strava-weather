-- AlterTable
ALTER TABLE "activity_logs" ALTER COLUMN "stravaActivityId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "failed_processing" ALTER COLUMN "stravaActivityId" SET DATA TYPE TEXT,
ALTER COLUMN "stravaAthleteId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "stravaAthleteId" SET DATA TYPE TEXT;
