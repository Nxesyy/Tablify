-- AddForeignKey
ALTER TABLE "detail_reservasis" ADD CONSTRAINT "detail_reservasis_id_member_fkey" FOREIGN KEY ("id_member") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
