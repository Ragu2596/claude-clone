FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN mkdir -p uploads
EXPOSE 3001
CMD ["node", "src/server.js"]
