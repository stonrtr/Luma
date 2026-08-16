-- AlterTable: поля токена скидання пароля
ALTER TABLE "User" ADD COLUMN "resetTokenHash" TEXT,
                   ADD COLUMN "resetTokenExp" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");
