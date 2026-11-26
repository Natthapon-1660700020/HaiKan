# ติดตั้งและเปิด HaiKan

1. ติดตั้ง Node.js 24 พร้อม npm ดาวน์โหลด ZIP จาก GitHub แล้วแตกไฟล์ เปิด PowerShell ในโฟลเดอร์ที่มี `package-lock.json`, `client` และ `server`
2. ติดตั้งแพ็กเกจจากโฟลเดอร์หลัก

   ```powershell
   npm ci
   ```

3. หากใช้ฐานข้อมูลของกลุ่ม ให้วางไฟล์ `.env` ที่ได้รับไว้ใน `server/` หากตั้งค่าใหม่ ให้คัดลอกไฟล์ตัวอย่างด้วยคำสั่งด้านล่าง แล้วใส่ URL จริงจาก Supabase ใน `server/.env` โดยใช้ `DATABASE_URL` สำหรับเว็บ และ `DIRECT_URL` สำหรับ migration กลุ่มนี้ใช้ Session pooler พอร์ต 5432 ได้ทั้งสองค่า หากรหัสผ่านมีอักขระพิเศษ ให้ URL-encode เฉพาะรหัสผ่าน

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

4. สร้าง Prisma Client และตรวจการเชื่อมต่อ

   ```powershell
   npm run generate -w server
   npm run check:db -w server
   ```

   สำหรับฐานข้อมูลใหม่ ให้สร้างตารางและข้อมูลตัวอย่างเพิ่มหนึ่งครั้ง

   ```powershell
   npm run migrate -w server
   npm run seed -w server
   ```

5. เปิด PowerShell สองหน้าต่างในโฟลเดอร์หลัก รันหน้าต่างละหนึ่งคำสั่ง แล้วเปิด [HaiKan บนเครื่อง](http://localhost:5173)

   | หน้าต่าง | คำสั่ง |
   |---|---|
   | API | `npm run dev:server` |
   | เว็บ | `npm run dev:client` |

   เปิดทั้งสองหน้าต่างค้างไว้ระหว่างใช้งาน ครั้งต่อไปบนเครื่องเดิมเริ่มที่ขั้นตอนที่ 5 ได้เลย
