FROM patidarmanoj/metronome-v2

WORKDIR /usr/src

COPY package*.json ./
RUN npm install
CMD tail -f /dev/null