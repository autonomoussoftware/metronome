FROM patidarmanoj/metronome-v2

WORKDIR /usr/src

COPY package*.json ./
RUN npm install
EXPOSE 8545 8546 8555 8556 30301 33333
CMD tail -f /dev/null