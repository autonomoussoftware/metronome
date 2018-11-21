FROM patidarmanoj/solc0.4.21

WORKDIR /usr/src

COPY . .

RUN apt-get update
RUN apt-get -y install wget

RUN apt-get -y install make

RUN wget http://download.redis.io/redis-stable.tar.gz
RUN tar xvzf redis-stable.tar.gz
WORKDIR /usr/src/redis-stable

RUN make
WORKDIR /usr/src

RUN apt-get update
RUN apt-get -y install sudo
RUN apt-get -y install curl
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash
RUN apt-get install nodejs
RUN apt-get -y install git

RUN apt-get -y install jq
RUN apt-get -y install lsof

RUN apt-get -y install software-properties-common
RUN add-apt-repository -y ppa:ethereum/ethereum
RUN apt-get update
RUN apt-get -y install ethereum

RUN cd ../

RUN wget https://releases.parity.io/v1.10.9/x86_64-unknown-linux-gnu/parity_1.10.9_ubuntu_amd64.deb

RUN dpkg -i parity_1.10.9_ubuntu_amd64.deb

CMD ["true"]