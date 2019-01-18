FROM patidarmanoj/solc0.4.21

WORKDIR /usr/src

COPY ./Dockerfile .

RUN apt-get update
RUN apt install -y redis-server
RUN apt-get install -y tmux
RUN apt-get -y install wget

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
RUN apt-get update
RUN apt-get install -y curl
RUN wget https://releases.parity.io/ethereum/v2.2.7/x86_64-unknown-linux-gnu/parity
RUN chmod u+x parity
RUN cp ./parity /usr/local/bin/