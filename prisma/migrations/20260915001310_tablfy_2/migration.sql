-- CreateTable
CREATE TABLE "makers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "app_key" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "makers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "makers_username_key" ON "makers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "makers_email_key" ON "makers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "makers_app_key_key" ON "makers"("app_key");
