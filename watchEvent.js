var MultiSigWallet = artifacts.require('./MultiSigWallet.sol');

//TODO: Use web3 to check this
const subscription = instance.chamouDelete();
subscription.on('data', evento => {
  console.log('==========================>', evento);
});

myContract.events
  .MyEvent(
    {
      filter: {
        myIndexedParam: [20, 23],
        myOtherIndexedParam: '0x123456789...',
      }, // Using an array means OR: e.g. 20 or 23
      fromBlock: 0,
    },
    function(error, event) {
      console.log(event);
    },
  )
  .on('data', function(event) {
    console.log(event); // same results as the optional callback above
  })
  .on('changed', function(event) {
    // remove event from local database
  })
  .on('error', console.error);

// Start reading from stdin so we don't exit.
process.stdin.resume();
