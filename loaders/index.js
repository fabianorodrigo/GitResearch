const logging = require('./logging');

module.exports.init = () => {
  // print header
  console.log('#'.padStart(150, '#').yellow);
  const title = 'Github Solidity Research';
  console.log(
    title.padStart(Math.floor(150 / 2 + title.length / 2), ' ').yellow,
  );
  console.log('#'.padStart(150, '#').yellow);

  // variaveis de ambiente
  require('dotenv').config();
  global.trace = true;
  // logging
  logging.setupLogging({ logName: 'GitResearch' });
  process.on('uncaughtException', err => {
    global.log.error(err);
    console.error(`Caught exception: ${err}\n`);
    console.error(err.stack);
  });
};
