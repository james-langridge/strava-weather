/*
  Warnings:

  - You are about to drop the `activity_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `failed_processing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_subscriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_userId_fkey";

-- DropTable
DROP TABLE "activity_logs";

-- DropTable
DROP TABLE "failed_processing";

-- DropTable
DROP TABLE "webhook_subscriptions";
