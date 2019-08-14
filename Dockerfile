FROM ubuntu:18.04

WORKDIR /usr/src

COPY ./Dockerfile .

RUN apt-get update
RUN apt-get install -y tmux

RUN apt-get update && \
apt-get -y install sudo  && \
apt-get -y install wget && \
apt-get -y install curl && \
apt-get -y install lsb

RUN apt-get update && apt-get install -y gnupg

RUN wget https://github.com/ethereum/solidity/releases/download/v0.4.21/solc-static-linux -O /usr/local/bin/solc && \
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

ENV QTUM_RELEASE 0.17.2
ENV QTUM_RELEASE_TAR qtum-${QTUM_RELEASE}-x86_64-linux-gnu.tar.gz

RUN wget https://github.com/qtumproject/qtum/releases/download/mainnet-ignition-v${QTUM_RELEASE}/${QTUM_RELEASE_TAR} && \
  tar -xf $QTUM_RELEASE_TAR -C /usr/local --strip-components=1 --exclude=*-qt --exclude=test_qtum --exclude=qtum-tx && \
  rm $QTUM_RELEASE_TAR

RUN wget https://github.com/ethereum/solidity/releases/download/v0.4.21/solc-static-linux -O /usr/local/bin/solc && \
   chmod 0755 /usr/local/bin/solc

RUN wget -v https://github.com/qtumproject/solar/releases/download/0.0.14/solar-linux-amd64 -O /usr/local/bin/solar && chmod 0755 /usr/local/bin/solar

COPY qcli /usr/local/bin
COPY qtumd-launch /usr/local/bin


ENV QTUM_DATADIR /dapp/.qtum
ENV QTUM_RPC_USER qtum
ENV QTUM_RPC_PASS test
#ENV QTUM_RPC http://$QTUM_RPC_USER:$QTUM_RPC_PASS@localhost:3889
ENV QTUM_RPC http://qtum:test@ec2-54-172-219-152.compute-1.amazonaws.com:3889
ENV QTUM_NETWORK testnet

VOLUME /dapp