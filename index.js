const fs = require('fs');
const path = require('path');
const colors = require('colors');
const bunyan = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');
const readlineSync = require('readline-sync');
const { spawn } = require('child_process');

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
const WIDTH = 150;
global.trace = true;
function printCentro(valor) {
  console.log(valor.padStart(Math.floor(WIDTH / 2 + valor.length / 2), ' ').yellow);
}

process.on('uncaughtException', (err) => {
  global.log.error(err);
  console.error(`Caught exception: ${err}\n`);
  console.error(err.stack);
});

const lineGraph = '#'.padStart(WIDTH, '#');
console.log(lineGraph.yellow);
printCentro('Github Solidity Research');
console.log(lineGraph.yellow);

(async () => {
  const filePathRepositoriesData = process.argv.length > 2 ? process.argv[2] : './data/gitHubSolidityRepos.json';
  let solidityRepos = {};

  if (fs.existsSync(filePathRepositoriesData)) {
    solidityRepos = JSON.parse(fs.readFileSync(filePathRepositoriesData, { encoding: 'UTF8' }));
  }

  const functionality = readlineSync.question(`What do you want to do?
  1. Retrieve/update local data from Github
  2. Analyse local data
  3. Detail truffled testable
  4. Clone all truffled testable repositories
  5. Execute tests

  Your choice: `);

  if (functionality === '4') {
    const repoTruffledWithTests = Object.values(solidityRepos).filter(sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0);
    cloneAndInstall(repoTruffledWithTests, 0, true);
  } else if (functionality === '3') {
    detailTruffleTestable(solidityRepos);
  } else if (functionality === '2') {
    showGlobalStats(solidityRepos);
  } else if (functionality === '1') {
    retrieveGithubData();
  }
})();

function showGlobalStats(solidityRepos) {
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
}

function detailTruffleTestable(solidityRepos) {
  const reposLoaded = Object.values(solidityRepos);
  const repoTruffledWithTests = reposLoaded.filter(sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0);
  const data = {};
  for (const r of repoTruffledWithTests) {
    let jsTestFiles = 0;
    let solTestFiles = 0;
    r.testTrees.forEach((t) => {
      if (t.children && Array.isArray(t.children)) {
        t.children.forEach((f) => {
          if (path.extname(f.path).toLowerCase() == '.js') {
            jsTestFiles += 1;
          } else if (path.extname(f.path).toLowerCase() == '.sol') {
            solTestFiles += 1;
          }
        });
      }
    });
    data[r.repo.full_name] = {
      stars: r.repo.stargazers_count,
      pushed_at: r.repo.pushed_at,
      testTrees: r.testTrees.length,
      JStestFiles: jsTestFiles,
      SOLtestFiles: solTestFiles,
      truffleTrees: r.truffleTrees.length,
    };
    data[r.repo.full_name]['size (MB)'] = parseFloat((r.repo.size / 1024).toFixed(2));
  }
  console.table(data);
}

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

async function retrieveGithubData() {
  const gitService = new GitHubService();

  const page = 0;
  const perPage = 100;

  const filePath = process.argv.length > 2 ? process.argv[2] : './data/gitHubSolidityRepos.json';
  const solidityRepos = {};
  const repos = null;
  const reposWithTest = [];

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

/**
 * Clone the repository referenced in {solidityRepos} in the position {index} and executes 'npm install'
 *
 * @param {Array} repos Collection of github repos
 * @param {number} index Position of the {solidityRepos} to be cloned
 * @param {boolean} cloneNext If TRUE, when finished the clone, will call the function again passsing {index}+1
 */
function cloneAndInstall(repos, index, cloneNext) {
  if (index >= repos.length) {
  } else {
    const childProcGit = spawn('git', ['clone', repos[index].repo.clone_url, `researchRepos/${repos[index].repo.full_name}`]);
    // Saídas de erro e padrão
    handleChildProc(childProcGit, repos[index].repo.full_name);
    // trata saída
    childProcGit.on('exit', async (code, signal) => {
      if (code === 0 && signal == null) {
        console.log(colors.green(`Concluído Git ${repos[index].repo.full_name}`));
      } else {
        console.warn(colors.yellow(`Erro onExit Git ${repos[index].repo.full_name}. Verifique o console para identificar a causa`));
      }
      // npm install
      const cwd = path.resolve('researchRepos', path.join(repos[index].repo.full_name, path.join(repos[index].testTrees[0].path), '..'));
      console.log('cwd', cwd);
      const childProcNpm = spawn('npm', ['install'], { cwd });
      // Saídas de erro e padrão
      handleChildProc(childProcNpm, repos[index].repo.full_name);
      // trata saída
      childProcNpm.on('exit', async (code, signal) => {
        if (code === 0 && signal == null) {
          console.log(colors.green(`Concluído npm install ${repos[index].repo.full_name}`));
        } else {
          console.warn(colors.yellow(`Erro onExit npm install ${repos[index].repo.full_name}. Verifique o console para identificar a causa`));
        }
        if (cloneNext) {
          cloneAndInstall(repos, index + 1, true);
        }
      });
      /* if (cloneNext) {
        cloneAndInstall(repos, index + 1, true);
      } */
    });
  }
}

function handleChildProc(childProc, repoFullName) {
  // Tratamento de erro
  childProc.on('error', (error) => {
    console.error(colors.red(`${repoFullName} Falhou no onError`), error);
  });

  // trata saída de erro
  childProc.stderr.on('data', (data) => {
    data = data.toString().split(/(\r?\n)/g);
    data.forEach((item, i) => {
      if (data[i] !== '\n' && data[i] !== '') {
        console.error(colors.yellow(`${repoFullName}`), colors.yellow(data[i]));
      }
    });
  });
  // Saída padrão
  childProc.stdout.on('data', (data) => {
    data = data.toString().split(/(\r?\n)/g);
    data.forEach((item, i) => {
      if (data[i] !== '\n' && data[i] !== '') {
        console.log(repoFullName, data[i]);
      }
    });
  });
}

/**
 * Execute 'truffle test' referenced in {solidityRepos} in the position {index}
 *
 * @param {Array} repos Collection of github repos
 * @param {number} index Position of the {solidityRepos} to be cloned
 * @param {boolean} testNext If TRUE, when finished the clone, will call the function again passsing {index}+1
 */
function executeTruffleTests(repos, index, testNext) {
  const filePathTestsData = process.argv.length > 2 ? process.argv[2] : './data/tests.json';
  const testData = fs.readFileSync(filePathTestsData, { encoding: 'UTF8' });
  if (index < repos.length) {
    repos[index].testTrees.forEach((t) => {
      if (!Object.prototype.hasOwnProperty.call(testData, repos[index].repo.full_name)) {
        testData[repos[index].repo.full_name] = {
          full_name: repos[index].repo.full_name,
        };
      }
      // parent directory of tests
      testData[repos[index].repo.full_name].testStart = new Date();
      testData[repos[index].repo.full_name].errors = [];
      testData[repos[index].repo.full_name].stdErrorEvents = [];
      testData[repos[index].repo.full_name].stdOutEvents = [];
      const cwd = path.resolve(path.join(repos[index].repo.full_name, t.path), '..');
      const childProcTruffle = spawn('truffle', ['test'], { cwd });
      // Tratamento de erro
      childProcTruffle.on('error', (error) => {
        testData[repos[index].repo.full_name].errors.push(error);
        fs.writeFileSync(filePathTestsData, testData, { encoding: 'UTF8' });
      });

      // trata saída de erro
      childProcTruffle.stderr.on('data', (data) => {
        testData[repos[index].repo.full_name].stdErrorEvents.push(data);
        fs.writeFileSync(filePathTestsData, testData, { encoding: 'UTF8' });
      });
      // Saída padrão
      childProcTruffle.stdout.on('data', (data) => {
        testData[repos[index].repo.full_name].stdOutEvents.push(data);
        fs.writeFileSync(filePathTestsData, testData, { encoding: 'UTF8' });
      });
      // trata saída
      childProcTruffle.on('exit', async (code, signal) => {
        testData[repos[index].repo.full_name].testFinish = new Date();
        testData[repos[index].repo.full_name].testExitCode = code;
        testData[repos[index].repo.full_name].testExitSignal = signal;
        if (code === 0 && signal == null) {
          console.log(colors.green(`Concluído test ${repos[index].repo.full_name}`));
        } else {
          console.warn(colors.yellow(`Erro onExit test ${repos[index].repo.full_name}. Verifique o console para identificar a causa`));
        }
        fs.writeFileSync(filePathTestsData, testData, { encoding: 'UTF8' });
        if (testNext) {
          executeTruffleTests(repos, index + 1, true);
        }
      });
    });
  }
}
