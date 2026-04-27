FROM node:20-alpine

WORKDIR /usr/src/app
RUN apk add --no-cache docker-cli

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
