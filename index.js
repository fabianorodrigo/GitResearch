const fs = require('fs');
const path = require('path');
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

  console.log(process.argv);

  const filePath = process.argv.length > 2 ? process.argv[2] : './data/gitHubSolidityRepos.json';
  let solidityRepos = {};
  let repos = null;
  const reposWithTest = [];

  if (fs.existsSync(filePath)) {
    solidityRepos = JSON.parse(fs.readFileSync(filePath, { encoding: 'UTF8' }));
  }

  const functionality = readlineSync.question(`What do you want to do?
  1. Retrieve/update local data from Github
  2. Analyse local data
  3. List trees of the testes stored local (experimental)

  Your choice: `);

  if (functionality === '3') {
    const reposLoaded = Object.values(solidityRepos);
    const repoTruffledWithTests = reposLoaded.filter(sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0);
    console.log('Truffled Testable:', repoTruffledWithTests.length);

    for (const r of repoTruffledWithTests) {
      console.log(colors.yellow(r.repo.full_name));
      for (const testTree of r.testTrees) {
        console.log(colors.green(testTree.path));
        const tree = await gitService.getATree({
          owner: r.repo.owner.login,
          repo: r.repo.name,
          tree_sha: testTree.sha,
        });
        tree.forEach((t) => {
          console.log(t.path);
        });
      }
    }
  } else if (functionality === '2') {
    console.log('#########################  REPOSITORY STATS #########################');
    const reposLoaded = Object.values(solidityRepos);
    printStarStatsTable(reposLoaded, 'Total');
    printStarStatsTable(reposLoaded.filter(sr => sr.truffleTrees.length > 0), 'Truffled');
    printStarStatsTable(reposLoaded.filter(sr => sr.testTrees.length > 0), 'Testable');

    const repoTruffledWithTests = reposLoaded.filter(sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0);
    printStarStatsTable(repoTruffledWithTests, 'Truffled Testable');
    const repoNOTruffledWithTests = reposLoaded.filter(sr => sr.testTrees.length > 0 && sr.truffleTrees.length == 0);
    printStarStatsTable(repoNOTruffledWithTests, 'Untruffled Testable');

    // Truffled with Tests
    let qtdByExtensao = countTestFilesByExtension(repoTruffledWithTests, 'Truffled With Tests');
    let qtdByQtdArquivosTeste = countReposByTestFilesQuantity(repoTruffledWithTests, 'Truffled With Tests');
    console.log('');
    Object.keys(qtdByQtdArquivosTeste).forEach((qtdFiles) => {
      console.log(`Truffle Testable - ${qtdFiles} files:`, qtdByQtdArquivosTeste[qtdFiles].qtdRepos, 'repositories');
    });
    console.log('');
    Object.keys(qtdByExtensao).forEach((ext) => {
      console.log(`Truffle Testable - files ${ext} `, qtdByExtensao[ext].qtd, 'files', qtdByExtensao[ext].qtdRepos, 'repositories');
    });

    // NO Truffled with Tests
    qtdByExtensao = countTestFilesByExtension(repoNOTruffledWithTests, 'NO Truffled With Tests');
    qtdByQtdArquivosTeste = countReposByTestFilesQuantity(repoNOTruffledWithTests, 'NO Truffled With Tests');
    console.log('');
    Object.keys(qtdByQtdArquivosTeste).forEach((qtdFiles) => {
      console.log(`NO Truffle Testable - ${qtdFiles} files:`, qtdByQtdArquivosTeste[qtdFiles].qtdRepos, 'repositories');
    });
    console.log('');
    Object.keys(qtdByExtensao).forEach((ext) => {
      console.log(`NO Truffle Testable - files ${ext} `, qtdByExtensao[ext].qtd, 'files', qtdByExtensao[ext].qtdRepos, 'repositories');
    });
  } else if (functionality === '1') {
    const filterStars = parseInt(
      readlineSync.question(`Apply filter of star count to search for tests and truffle?
  0. No filter
  N. Quantity of stars (N is the minimum quantity of stars to include in the search for tests and truffle)

  Stars: `),
    );

    const forceSearchTest = readlineSync.question("Search for 'test' and 'tests' even if it's already have a list (s/N)?: ").toUpperCase() === 'S';

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
        if (solidityRepos[r.full_name].testTrees.length == 0 || forceSearchTest) {
          // Just to don't be interpreted as abuse detection by github.com
          await new Promise(done => setTimeout(done, 2000));
          let searchResult = await gitService.searchTreesInRepository({
            repo: r.name,
            owner: r.owner.login,
            names: ['test', 'tests'],
          });

          if (searchResult instanceof Error) {
            // wait 10s and try again
            await new Promise(done => setTimeout(done, 10000));
            searchResult = await gitService.searchTreesInRepository({
              repo: r.name,
              owner: r.owner.login,
              names: ['test', 'tests'],
            });
            if (searchResult instanceof Error) {
              console.log(r.owner.login, r.name, colors.red(searchResult.message));
              continue;
            }
          }

          // Buscar os arquivos dentro dos diretorios 'test' ou 'tests'
          for (const testDir of searchResult) {
            testDir.children = [];
            console.log(colors.green(testDir.path));
            let tree = await gitService.getATree({
              repo: r.name,
              owner: r.owner.login,
              tree_sha: testDir.sha,
              recursive: 1,
            });
            if (tree instanceof Error) {
              // wait 10s and try again
              await new Promise(done => setTimeout(done, 10000));
              tree = await gitService.getATree({
                repo: r.name,
                owner: r.owner.login,
                tree_sha: testDir.sha,
                recursive: 1,
              });
              if (tree instanceof Error) {
                console.log(r.owner.login, r.name, colors.yellow(testDir.path), colors.red(searchResult.message));
                continue;
              }
            }
            tree.forEach((t) => {
              console.log(t.path);
              if (t.size > 0) {
                testDir.children.push(t);
              }
            });
          }
          solidityRepos[r.full_name].testTrees = searchResult;

          fs.writeFileSync(filePath, JSON.stringify(solidityRepos, null, 4), {
            encoding: 'UTF8',
          });
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
          fs.writeFileSync(filePath, JSON.stringify(solidityRepos, null, 4), {
            encoding: 'UTF8',
          });
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

function printStarStatsTable(dataArray, label) {
  const data = {};
  data[label] = { qtdRepositories: dataArray.length };
  data[`${label} Starred:`] = { qtdRepositories: dataArray.filter(sr => sr.repo.stargazers_count > 0).length };
  data[`${label} 10+Stars:`] = { qtdRepositories: dataArray.filter(sr => sr.repo.stargazers_count >= 10).length };
  data[`${label} 50+Stars:`] = { qtdRepositories: dataArray.filter(sr => sr.repo.stargazers_count >= 50).length };
  data[`${label} 100+Stars:`] = { qtdRepositories: dataArray.filter(sr => sr.repo.stargazers_count >= 100).length };
  console.table(data);
}

function countTestFilesByExtension(repos) {
  const qtdByExtensao = {};

  repos.forEach((r) => {
    let totalFiles = 0;
    r.testTrees.forEach((t) => {
      if (t.children && Array.isArray(t.children)) {
        t.children.forEach((f) => {
          // sum files of repository
          totalFiles += 1;
          // calc by extension
          if (qtdByExtensao[path.extname(f.path).toLowerCase()] == null) {
            qtdByExtensao[path.extname(f.path).toLowerCase()] = {
              qtd: 0,
              qtdRepos: 0,
            };
          }
          qtdByExtensao[path.extname(f.path).toLowerCase()].qtd += 1;
          if (r.repo.full_name !== qtdByExtensao[path.extname(f.path).toLowerCase()].ultimoRepositorio) {
            qtdByExtensao[path.extname(f.path).toLowerCase()].ultimoRepositorio = r.repo.full_name;
            qtdByExtensao[path.extname(f.path).toLowerCase()].qtdRepos += 1;
          }
        });
      }
    });
  });
  return qtdByExtensao;
}

function countReposByTestFilesQuantity(repos) {
  const qtdByQtdArquivosTeste = {};

  repos.forEach((r) => {
    let totalFiles = 0;
    r.testTrees.forEach((t) => {
      if (t.children && Array.isArray(t.children)) {
        totalFiles += t.children.length;
      }
    });
    if (qtdByQtdArquivosTeste[totalFiles] == null) {
      qtdByQtdArquivosTeste[totalFiles] = { qtdRepos: 0, repos: [] };
    }
    qtdByQtdArquivosTeste[totalFiles].qtdRepos += 1;
    qtdByQtdArquivosTeste[totalFiles].repos.push(r.repo.full_name);
  });
  return qtdByQtdArquivosTeste;
}

function printStarStats(dataArray, label) {
  console.log(label, ':', dataArray.length);
  console.log(`${label} Starred:`, dataArray.filter(sr => sr.repo.stargazers_count > 0).length);
  console.log(`${label} 10+Stars:`, dataArray.filter(sr => sr.repo.stargazers_count >= 10).length);
  console.log(`${label} 50+Stars:`, dataArray.filter(sr => sr.repo.stargazers_count >= 50).length);
  console.log(`${label} 100+Stars:`, dataArray.filter(sr => sr.repo.stargazers_count >= 100).length);
  console.log('');
}
