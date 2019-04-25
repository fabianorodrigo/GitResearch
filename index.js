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

  let page = 0;
  const perPage = 100;

  let repos = null;
  const reposWithTest = [];

  do {
    page++;
    // Retrieve all Solidity repositories
    repos = await gitService.getReposByLanguage({
      language: 'Solidity',
      sort: 'stars',
      order: 'desc',
      page,
      per_page: perPage,
    });
    console.log(repos.total_count, repos.items.length);

    // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
    for (const r of repos.items) {
      // console.log(r)
      console.log(colors.yellow(r.full_name), ':', r.description);
      console.log('URL JSON:', r.url);
      console.log('URL:', r.html_url);
      console.log('GIT:', r.git_url);
      // Just to don't be interpreted as abuse detection by github.com
      await new Promise(done => setTimeout(done, 2000));
      // const searchResult = await gitService.getExpressionInContent({ repo: r.name, expression });
      // const searchResult = await gitService.getFilesInRepo({ repo: r.full_name, name: 'test' });
      const searchResult = await gitService.searchRepositoryWithDiretory({
        repo: r.name,
        owner: r.owner.login,
        directoriesNames: ['test', 'tests'],
      });
      console.log(searchResult);
      if (searchResult.length > 0) {
        reposWithTest.push({
          name: r.name,
          r,
        });
      }
      if (searchResult instanceof Error) {
        // wait 10s and try again
        await new Promise(done => setTimeout(done, 10000));
        const searchResult = await gitService.searchRepositoryWithDiretory({
          repo: r.name,
          owner: r.owner.login,
          directoriesNames: ['test', 'tests'],
        });
        console.log(searchResult);
      }
      /* if (searchResult.items && searchResult.items.length > 0) {
            console.log(colors.blue(`${r.name} contains '${expression}'`));
            await Promise.all(searchResult.map(async sr => {
                console.log(r.name, sr);
                return;
            }));
        } else {
            console.log(colors.red(`${r.name} DOES NOT contain '${expression}'`));
        } */
    }
  } while (page * perPage < repos.total_count);

  console.log(colors.blue(`${reposWithTest.length} of ${repos.items.length} repos with tests`));
  reposWithTest.forEach((p) => {
    console.log(p.name);
  });
})();
