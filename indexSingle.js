const colors = require('colors');
const bunyan = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');
const GitHubService = require('./GitHubService');

const logOptions = {
  name: '/queriesAvulsas',
  streams: [
    {
      stream: new RotatingFileStream({
        level: 'debug',
        path: 'logs/log%Y%m%d.json',
        period: '1d', // daily rotation
        totalFiles: 10, // keep up to 10 back copies
        rotateExisting: true, // Give ourselves a clean file when we start up, based on period
        threshold: '10m', // Rotate log files larger than 10 megabytes
        totalSize: '20m', // Don't keep more than 20mb of archived log files
        gzip: true, // Compress the archive log files to save space
        src: true, // Include info about the source of the error
      }),
    },
  ],
};

global.log = bunyan.createLogger(logOptions);

function printCentro(valor) {
  console.log(valor.padStart(Math.floor(WIDTH / 2 + valor.length / 2), ' ').yellow);
}

process.on('uncaughtException', (err) => {
  global.log.error(err);
  console.error(`Caught exception: ${err}\n`);
  console.error(err.stack);
});

const WIDTH = 150;
global.trace = true;

const lineGraph = '#'.padStart(WIDTH, '#');
console.log(lineGraph.yellow);
printCentro('Starting querying ');
console.log(lineGraph.yellow);

(async () => {
  const gitService = new GitHubService();

  const searchResult = await gitService.searchRepositoryWithDiretory({
    repo: 'bndestoken',
    owner: 'bndes',
    directoriesNames: ['test', 'tests'],
  });
  console.log(searchResult);
})();
