const fs = require('fs');
const colors = require('colors');
const bunyan = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');
const readlineSync = require('readline-sync');
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

  const filePath = './data/gitHubSolidityRepos.json';
  let solidityRepos = {};
  let repos = null;
  const reposWithTest = [];

  if (fs.existsSync(filePath)) {
    solidityRepos = JSON.parse(fs.readFileSync(filePath, { encoding: 'UTF8' }));
  }

  const functionality = readlineSync.question(`What do you want to do?
  1. Retrieve/update local data from Github
  2. Analyse local data

  Your choice: `);

  if (functionality === '2') {
    console.log('#########################  REPOSITORY STATS #########################');
    const reposLoaded = Object.values(solidityRepos);
    console.log('Total repos:', reposLoaded.length);
    console.log('');
    console.log('Total Starred:', reposLoaded.filter(sr => sr.repo.stargazers_count > 0).length);
    console.log('Total 10+Stars:', reposLoaded.filter(sr => sr.repo.stargazers_count >= 10).length);
    console.log('Total 50+Stars:', reposLoaded.filter(sr => sr.repo.stargazers_count >= 50).length);
    console.log('Total 100+Stars:', reposLoaded.filter(sr => sr.repo.stargazers_count >= 100).length);
    console.log('');
    console.log('Truffled:', reposLoaded.filter(sr => sr.truffleTrees.length > 0).length);
    console.log('Truffled Starred:', reposLoaded.filter(sr => sr.truffleTrees.length > 0 && sr.repo.stargazers_count > 0).length);
    console.log('Truffled 10+Stars:', reposLoaded.filter(sr => sr.truffleTrees.length > 0 && sr.repo.stargazers_count >= 10).length);
    console.log('Truffled 50+Stars:', reposLoaded.filter(sr => sr.truffleTrees.length > 0 && sr.repo.stargazers_count >= 50).length);
    console.log('Truffled 100+Stars:', reposLoaded.filter(sr => sr.truffleTrees.length > 0 && sr.repo.stargazers_count >= 100).length);
    console.log('');
    const repoWithTests = reposLoaded.filter(sr => sr.testTrees.length > 0);
    repoWithTests.sort((a, b) => {
      if (a.repo.stargazers_count < b.repo.stargazers_count) {
        return 1;
      }
      if (a.repo.stargazers_count > b.repo.stargazers_count) {
        return -1;
      }
      // a deve ser igual a b
      return 0;
    });
    console.log('');
    console.log('Testable:', repoWithTests.length);
    console.log('Testable Starred:', repoWithTests.filter(sr => sr.repo.stargazers_count > 0).length);
    console.log('Testable 10+Stars:', repoWithTests.filter(sr => sr.repo.stargazers_count >= 10).length);
    console.log('Testable 50+Stars:', repoWithTests.filter(sr => sr.repo.stargazers_count >= 50).length);
    console.log('Testable 100+Stars:', repoWithTests.filter(sr => sr.repo.stargazers_count >= 100).length);
    console.log(
      `######################### 10+ STARS REPOS WITH TEST TREES: ${repoWithTests.filter(sr => sr.repo.stargazers_count >= 10).length} / ${
        reposLoaded.length
      } #########################`,
    );
    repoWithTests
      .filter(sr => sr.repo.stargazers_count >= 10)
      .forEach((r) => {
        console.log(colors.yellow(r.repo.full_name), colors.blue(r.repo.stargazers_count));
        console.log('Truffle?', r.truffleTrees.length == 0 ? colors.red('NO') : colors.green('YES'));
        console.log('Tests Trees:', r.testTrees.length);
        console.log(r.repo.git_url);
      });
  } else if (functionality === '1') {
    const filterStars = parseInt(
      readlineSync.question(`Apply filter of star count to search for tests and truffle?
  0. No filter
  N. Quantity of stars (N is the minimum quantity of stars to include in the search for tests and truffle)

  Stars: `),
    );

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
        if (r.stargazers_count < filterStars) {
          continue;
        }
        console.log(colors.yellow(r.full_name), ':', r.description);
        console.log('URL JSON:', r.url);
        console.log('URL:', r.html_url);
        console.log('GIT:', r.git_url);
        console.log('Stars:', r.stargazers_count);
        if (!solidityRepos[r.full_name]) {
          solidityRepos[r.full_name] = {
            repo: r,
            testTrees: [],
            truffleTrees: [],
          };
          console.log(colors.cyan('NEW'));
        } else if (solidityRepos[r.full_name].repo.stargazers_count != r.stargazers_count) {
          console.log(colors.magenta(`UPDATE STARS from ${solidityRepos[r.full_name].repo.stargazers_count} to ${r.stargazers_count}`));
          solidityRepos[r.full_name].repo.stargazers_count = r.stargazers_count;
          fs.writeFileSync(filePath, solidityRepos, { encoding: 'UTF8' });
        }

        // SEARCH FOR DIRECTORIES 'test' OR 'tests'
        // search only if there is no item in the results
        if (solidityRepos[r.full_name].testTrees.length == 0) {
          // Just to don't be interpreted as abuse detection by github.com
          await new Promise(done => setTimeout(done, 2000));
          const searchResult = await gitService.searchTreesInRepository({
            repo: r.name,
            owner: r.owner.login,
            names: ['test', 'tests'],
          });

          if (searchResult instanceof Error) {
            // wait 10s and try again
            await new Promise(done => setTimeout(done, 10000));
            const searchResult = await gitService.searchTreesInRepository({
              repo: r.name,
              owner: r.owner.login,
              names: ['test', 'tests'],
            });
            if (searchResult instanceof Error) {
              console.log(r.owner.login, r.name, colors.red(searchResult.message));
            }
          } else {
            solidityRepos[r.full_name].testTrees = searchResult;
          }
          fs.writeFileSync(filePath, JSON.stringify(solidityRepos, null, 4), { encoding: 'UTF8' });
        }

        // SEARCH FOR FILES 'trufle.js' OR 'trufle-config.js'
        // search only if there is no item in the results
        if (solidityRepos[r.full_name].truffleTrees == null || solidityRepos[r.full_name].truffleTrees.length == 0) {
          // Just to don't be interpreted as abuse detection by github.com
          await new Promise(done => setTimeout(done, 2000));
          const searchResult = await gitService.searchTreesInRepository({
            repo: r.name,
            owner: r.owner.login,
            names: ['trufle.js', 'truffle-config.js'],
            treeType: 'blob',
          });

          if (searchResult instanceof Error) {
            // wait 10s and try again
            await new Promise(done => setTimeout(done, 10000));
            const searchResult = await gitService.searchTreesInRepository({
              repo: r.name,
              owner: r.owner.login,
              names: ['trufle.js', 'truffle-config.js'],
              treeType: 'blob',
            });
            if (searchResult instanceof Error) {
              console.log(r.owner.login, r.name, colors.red(searchResult.message));
            }
          } else {
            solidityRepos[r.full_name].truffleTrees = searchResult;
          }
          fs.writeFileSync(filePath, JSON.stringify(solidityRepos, null, 4), { encoding: 'UTF8' });
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
  }
})();
