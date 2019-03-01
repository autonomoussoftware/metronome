FROM ubuntu:18.04

WORKDIR /usr/src

COPY ./Dockerfile .

RUN apt-get update
RUN apt install -y redis-server
RUN apt-get install -y tmux

RUN apt-get update && \
apt-get -y install sudo  && \
apt-get -y install wget && \
apt-get -y install curl && \
apt-get -y install lsb

RUN apt-get update && apt-get install -y gnupg

RUN wget https://github.com/ethereum/solidity/releases/download/v0.4.25/solc-static-linux -O /usr/local/bin/solc && \
   chmod u+x /usr/local/bin/solc

RUN apt-get -y install jq
RUN apt-get -y install lsof   

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash
RUN apt-get -y install nodejs
RUN apt-get -y install git

RUN apt-get -y install software-properties-common
RUN add-apt-repository -y ppa:ethereum/ethereum
RUN apt-get update
RUN apt-get -y install ethereum
RUN apt-get update
RUN apt-get install -y curl
RUN wget https://releases.parity.io/ethereum/v2.3.2/x86_64-unknown-linux-gnu/parity
RUN chmod u+x parity
RUN cp ./parity /usr/local/bin/

EXPOSE 8545 8546 8555 8556