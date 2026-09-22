-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN_SPACE');

-- CreateEnum
CREATE TYPE "Tipe" AS ENUM ('DESK', 'MEETING_ROOM', 'PRIVATE_OFFICE');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('Belum_Dikonfirmasi', 'Disetujui', 'aktif', 'selesai', 'dibatalkan');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" SERIAL NOT NULL,
    "nama_member" VARCHAR(255) NOT NULL,
    "Instansi" VARCHAR(255) NOT NULL,
    "alamat" TEXT NOT NULL,
    "telp" VARCHAR(255) NOT NULL,
    "id_user" INTEGER NOT NULL,
    "foto" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_owners" (
    "id" SERIAL NOT NULL,
    "nama_coworking" VARCHAR(255) NOT NULL,
    "nama_pemilik" VARCHAR(255) NOT NULL,
    "telp" VARCHAR(255) NOT NULL,
    "id_user" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaces" (
    "id" SERIAL NOT NULL,
    "nama_space" VARCHAR(255) NOT NULL,
    "harga_per_jam" DOUBLE PRECISION NOT NULL,
    "tipe" "Tipe" NOT NULL,
    "kapasitas" INTEGER NOT NULL,
    "foto" VARCHAR(255),
    "deskripsi" TEXT NOT NULL,
    "id_owner" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservasi" (
    "id" SERIAL NOT NULL,
    "tanggal_reservasi" TIMESTAMP(3) NOT NULL,
    "jam_mulai" TIMESTAMP(3) NOT NULL,
    "durasi_jam" INTEGER NOT NULL,
    "id_owner" INTEGER NOT NULL,
    "id_member" INTEGER NOT NULL,
    "status" "Status" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_reservasis" (
    "id" SERIAL NOT NULL,
    "id_reservasi" INTEGER NOT NULL,
    "id_space" INTEGER NOT NULL,
    "id_member" INTEGER NOT NULL,
    "id_diskon" INTEGER NOT NULL,
    "total_harga" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "detail_reservasis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diskons" (
    "id" SERIAL NOT NULL,
    "nama_diskkon" VARCHAR(255) NOT NULL,
    "presentase_diskon" DOUBLE PRECISION NOT NULL,
    "tanggal_awal" TIMESTAMP(3) NOT NULL,
    "tanggal_akhir" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diskons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "members_id_user_key" ON "members"("id_user");

-- CreateIndex
CREATE UNIQUE INDEX "space_owners_id_user_key" ON "space_owners"("id_user");

-- CreateIndex
CREATE UNIQUE INDEX "detail_reservasis_id_reservasi_key" ON "detail_reservasis"("id_reservasi");

-- CreateIndex
CREATE UNIQUE INDEX "detail_reservasis_id_diskon_key" ON "detail_reservasis"("id_diskon");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_owners" ADD CONSTRAINT "space_owners_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_id_owner_fkey" FOREIGN KEY ("id_owner") REFERENCES "space_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservasi" ADD CONSTRAINT "Reservasi_id_owner_fkey" FOREIGN KEY ("id_owner") REFERENCES "space_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservasi" ADD CONSTRAINT "Reservasi_id_member_fkey" FOREIGN KEY ("id_member") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_reservasis" ADD CONSTRAINT "detail_reservasis_id_reservasi_fkey" FOREIGN KEY ("id_reservasi") REFERENCES "Reservasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_reservasis" ADD CONSTRAINT "detail_reservasis_id_diskon_fkey" FOREIGN KEY ("id_diskon") REFERENCES "diskons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_reservasis" ADD CONSTRAINT "detail_reservasis_id_space_fkey" FOREIGN KEY ("id_space") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
