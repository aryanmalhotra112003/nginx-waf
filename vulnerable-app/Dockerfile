FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install

COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]
