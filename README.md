# metronome

Metronome Token as described in the [Metronome User's Manual](https://www.metronome.io/pdf/owners_manual.pdf)

### Requirements

You will need a MacOS or Linux system. 

Install the latest version of `Parity`.

### Getting started

Use the `deploy` script to start a Parity dev instancde where you can play around with Metronome.

Metronome includes a developer dashboard that runs in a terminal window.  See the instructions in the `terminal` directory to install and use this dashboard.

See the `test*.js` files in the `js` directory for examples of how to call the various Metronome contracts.   If you run deploy using the `--seed` and `-i` options, you can call `loadScript("js/testLater.js")` to run some very basic tests on the contracts.

Since Metronome works on a timed basis, it can be useful to "speed up" time so that you can see what will happen in an auction.   You can "speed up" time via the `-t` option to `deploy`