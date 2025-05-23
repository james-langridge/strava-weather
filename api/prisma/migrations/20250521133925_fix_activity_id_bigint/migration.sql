-- AlterTable
ALTER TABLE "activity_logs" ALTER COLUMN "stravaActivityId" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "failed_processing" ALTER COLUMN "stravaActivityId" SET DATA TYPE BIGINT,
ALTER COLUMN "stravaAthleteId" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "stravaAthleteId" SET DATA TYPE BIGINT;
