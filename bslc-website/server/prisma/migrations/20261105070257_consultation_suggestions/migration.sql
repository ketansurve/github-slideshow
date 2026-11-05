-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('PARTICIPANTS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PUBLISHED', 'PENDING', 'REJECTED');

-- DropForeignKey
ALTER TABLE "ConsultationComment" DROP CONSTRAINT "ConsultationComment_userId_fkey";

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "allowPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibility" "CommentVisibility" NOT NULL DEFAULT 'PARTICIPANTS';

-- AlterTable
ALTER TABLE "ConsultationComment" ADD COLUMN     "moderatedById" TEXT,
ADD COLUMN     "publicEmail" TEXT,
ADD COLUMN     "publicName" TEXT,
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "repliedById" TEXT,
ADD COLUMN     "reply" TEXT,
ADD COLUMN     "status" "CommentStatus" NOT NULL DEFAULT 'PUBLISHED',
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ConsultationComment" ADD CONSTRAINT "ConsultationComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every suggestion must be attributable: either an account, or the name and
-- e-mail given by a submitter without one.
ALTER TABLE "ConsultationComment" ADD CONSTRAINT "ConsultationComment_author_check"
  CHECK ("userId" IS NOT NULL OR ("publicName" IS NOT NULL AND "publicEmail" IS NOT NULL));
