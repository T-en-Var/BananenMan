FROM node:22-slim

# git, openssl (required by Prisma's query engine on Debian slim images), and a build
# toolchain (python3/make/g++) since @discordjs/opus has no prebuilt binary for every
# Node version/arch and falls back to compiling itself from source via node-gyp.
RUN apt-get update && apt-get install -y git openssl python3 make g++ && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Apply any pending migrations before the bot connects, then start the compiled build
# already baked into this image (no bind mount, so nothing here needs to be redone).
CMD ["sh", "-c", "npx prisma migrate deploy && npm run bot"]
