# Dockerfile — สร้าง Docker image สำหรับ CRM app
# ใช้ multi-stage build เพื่อให้ image เล็กที่สุด

# ─── Base image ───────────────────────────────────────────────────────────────
# ใช้ Node.js 20 บน Alpine Linux (เล็กกว่า debian มาก)
FROM node:20-alpine

# กำหนด working directory ภายใน container
WORKDIR /app

# ─── Install dependencies ─────────────────────────────────────────────────────
# Copy package files ก่อน เพื่อใช้ประโยชน์จาก Docker layer caching
# ถ้า package.json ไม่เปลี่ยน layer นี้จะถูก cache ไม่ต้อง npm install ใหม่
COPY package*.json ./
RUN npm install --production

# ─── Copy source code ────────────────────────────────────────────────────────
COPY . .

# ─── Configuration ───────────────────────────────────────────────────────────
# เปิด port 3000 (ต้องตรงกับ process.env.PORT)
EXPOSE 3000

# Environment variables สำหรับ production
ENV NODE_ENV=production

# ─── Start command ────────────────────────────────────────────────────────────
CMD ["node", "server.js"]
