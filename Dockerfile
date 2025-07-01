FROM node:20.17.0

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 8000

# Add this if you're using bcrypt
RUN npm rebuild bcrypt --build-from-source

COPY wait-for-it.sh ./
CMD [ "./wait-for-it.sh", "mongodb:27017", "--", "npm", "run", "dev" ]