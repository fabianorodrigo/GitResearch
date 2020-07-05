const fs = require('fs');
const path = require('path');
const colors = require('colors');
const loaders = require('./loaders');
const readlineSync = require('readline-sync');
const { spawn } = require('child_process');
const queries = require('./queries');
const repositories = require('./repositories');

loaders.init();

const SolidityTruffleUtilsFactory = require('./factories/SolidityTruffleUtilsFactory');
const ResultsQueryFactory = require('./factories/ResultsQueryFactory');
const GitHubService = require('./factories/GitHubService');

let targetCloneDir = process.env.SOLIDITY_REPOS_DIRECTORY;

const targets = fs.readdirSync('./data');
targets.forEach((target, i) => {
  console.log(i, target);
});
let tpd = null;
while (tpd == null || isNaN(parseInt(tpd)) || parseInt(tpd) >= targets.length) {
  tpd = readlineSync.question(`Select your target projects directory: `);
}

targetCloneDir = path.join(targetCloneDir, targets[tpd]);
const dateRef = new Date(
  `${targets[tpd].substr(0, 4)}-${targets[tpd].substr(4, 2)}-${targets[
    tpd
  ].substr(6, 2)}`,
);

console.log(dateRef);

(async () => {
  // Dados de todos os repositórios Solidity
  const filePathRepositoriesData = `./data/${
    targets[tpd]
  }/gitHubSolidityRepos.json`;
  const filePathResearchData = `./data/${targets[tpd]}/researchScopeData.json`;
  let solidityRepos = {};
  if (fs.existsSync(filePathRepositoriesData)) {
    solidityRepos = JSON.parse(
      fs.readFileSync(filePathRepositoriesData, { encoding: 'UTF8' }),
    );
  } else if (!fs.existsSync(path.dirname(filePathRepositoriesData))) {
    fs.mkdirSync(path.dirname(filePathRepositoriesData));
  }

  const repoTruffledWithTests = Object.values(solidityRepos).filter(
    sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0,
  );
  const solidityTruffleUtils = SolidityTruffleUtilsFactory({
    repos: repoTruffledWithTests,
    targetCloneDir,
    filePathResearchData,
  });
  const resultsQuery = ResultsQueryFactory({
    repos: repoTruffledWithTests,
    filePathResearchData,
  });

  let functionality = readlineSync.question(`What do you want to do?
  1. Retrieve/update local Solidity repositories data from Github
  2. Analyse Solidity repositories local data

  4. Clone all truffled testable Solidity repositories

  5. Compile truffled testable Solidity repositories
  6. Compile One
  7. Recompile all compilation fails

  8. Migrate truffled compiled with test directory
  9. Migrate One
  10. Migrate all migration fails

  50. Test truffled compiled with test directory
  51. Test One
  52. Retest all projects that fail to execute test (not tested)

  80. Install solidity-coverage on Successfull Tests Projects
  81. Execute Sonar Scanner for successfull tests (create sonar-project.properties)

  99. Rollback truffles-config.js
  100. Show Results

  0. EXIT

  Your choice: `);

  if (functionality === '100') {
    queries(resultsQuery);
  } else if (functionality === '99') {
    rollbackTrufflesConfig(
      Object.values(solidityRepos).filter(
        sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0,
      ),
    );
  } else if (functionality === '81') {
    await solidityTruffleUtils.executeSonarScanner(0, true);
  } else if (functionality === '80') {
    const researchScopeData = Object.values(
      solidityTruffleUtils.getResearchScopeData(),
    );

    const scopeIndexes = [];
    researchScopeData.forEach((item, i) => {
      scopeIndexes.push(item.index);
      console.log(item.key);
    });

    /*await solidityTruffleUtils.npmInstallInResearchProjectsList(
      scopeIndexes,
      'solidity-coverage',
    );*/
  } else if (functionality === '52') {
    /*
    const regexPassing = /(\d+) passing/gm;

    const notTested = [];
    const researchData = Object.values(resultsQuery.getResearchData());
    researchData.forEach((item, i) => {
      if (
        !Array.isArray(item.testStdOutEvents) ||
        (item.migrateExitCode !== 0 && item.migrateExitCode != null)
      ) {
        return false;
      }
      regexPassing.lastIndex = 0;
      const testStdOutEvents = item.testStdOutEvents.join(' ');
      const matchPassing = regexPassing.exec(testStdOutEvents);
      if (matchPassing == null) {
        const errors =
          testStdOutEvents.indexOf('Exceeds block gas limit') > -1
            ? testStdOutEvents.substr(
                testStdOutEvents.indexOf('Exceeds block gas limit'),
                100,
              )
            : '';
        //console.log(item.testStdOutEvents);
        notTested.push({
          i,
          projectPath: path.dirname(item.key),
          error: errors,
        });
      }
    });

    notTested.forEach(prj => {
      console.log(prj.i, prj.projectPath, prj.error);
    });
    //console.log(reposNotTested);
    //const retestIndex = readlineSync.question(`Retestar: `);
    for (const nt of notTested) {
      await solidityTruffleUtils.test(nt.i, false);
    }*/
    await solidityTruffleUtils.test(0, true, true);
  } else if (functionality === '51') {
    const result = resultsQuery.showResults('test', true, null, null, {
      property: 'test',
      value: false,
    });

    let choice = readlineSync.question(`Test: `);
    if (result[choice]) {
      await solidityTruffleUtils.test(
        Object.keys(resultsQuery.getResearchData()).findIndex(key =>
          path.dirname(key).startsWith(result[choice].full_name),
        ),
        false,
      );
    }
  } else if (functionality === '50') {
    await solidityTruffleUtils.test(0, true);
  } else if (functionality === '10') {
    await solidityTruffleUtils.migrate(0, true, true);
  } else if (functionality === '9') {
    const result = resultsQuery.showResults('migrate', true, false, null);

    let choice = readlineSync.question(`Migrate: `);
    if (result[choice]) {
      await solidityTruffleUtils.migrate(
        Object.keys(resultsQuery.getResearchData()).findIndex(key =>
          path.dirname(key).startsWith(result[choice].full_name),
        ),
        false,
      );
    }
  } else if (functionality === '8') {
    await solidityTruffleUtils.migrate(0, true);
  } else if (functionality === '7') {
    /*rollbackTrufflesConfig(
      Object.values(solidityRepos).filter(
        sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0,
      ),
    );*/

    const compilationFailed = Object.values(
      resultsQuery.getResearchData(),
    ).filter(item => {
      return item.compileExitCode !== 0;
    });

    await Promise.all(
      await compilationFailed.map(async item => {
        rollbackTruffleConfig(
          path.join(targetCloneDir, path.dirname(item.key)),
        );
      }),
    );

    const reposCompilationFail = [];
    for (const c of compilationFailed) {
      reposCompilationFail.push(
        repoTruffledWithTests.find(itemRepoTruffleWithTests => {
          return itemRepoTruffleWithTests.repo.full_name === c.full_name;
        }),
      );
    }

    const solidityCompilationFailTruffleUtils = SolidityTruffleUtilsFactory({
      repos: reposCompilationFail,
      targetCloneDir,
    });
    //console.log(reposCompilationFail);
    await solidityCompilationFailTruffleUtils.compile(0, 0, true);
  } else if (functionality === '6') {
    const previousCompilationResult = readlineSync
      .question('List: (s)uccessfull / (f)ailed / (A)ll ')
      .toUpperCase();
    let successFilter = null;
    if (previousCompilationResult === 'S') {
      successFilter = true;
    } else if (previousCompilationResult === 'F') {
      successFilter = false;
    }
    const result = resultsQuery.showResults(
      'compile',
      true,
      successFilter,
      null,
    );

    let choice = readlineSync.question(`Recompile: `);
    if (result[choice]) {
      rollbackTruffleConfig(
        path.join(targetCloneDir, path.dirname(result[choice].key)),
      );

      const solcversion = readlineSync
        .question(
          `Solidity compiler version (empty for discover dinamically in the .sol files):`,
        )
        .trim();
      await solidityTruffleUtils.compile(
        repoTruffledWithTests.findIndex(item => {
          return item.repo.full_name.startsWith(result[choice].full_name);
        }),
        0,
        false,
        false,
        solcversion != '' ? solcversion : null,
      );
    }
  } else if (functionality === '5') {
    await solidityTruffleUtils.compile(0, 0, true);
  } else if (functionality === '4') {
    await solidityTruffleUtils.cloneAndInstall(0, true);
  } else if (functionality === '2') {
    repositories(solidityRepos, dateRef);
  } else if (functionality === '1') {
    const solidityRepos = {};
    await retrieveGithubData(
      filePathRepositoriesData,
      'created:<2019-01-01',
      solidityRepos,
    );
    await retrieveGithubData(
      filePathRepositoriesData,
      'created:>=2019-01-01',
      solidityRepos,
    );
  }

  //process.stdin.resume();
})();

async function retrieveGithubData(
  filePathRepositoriesData,
  additionalFilter,
  solidityRepos,
) {
  const gitService = new GitHubService();

  let page = 0;
  const perPage = 100;

  let repos = null;
  const reposWithTest = [];

  const filterStars = parseInt(
    readlineSync.question(`Apply filter of star count to search for tests and truffle?
  0. No filter
  N. Quantity of stars (N is the minimum quantity of stars to include in the search for tests and truffle)

  Stars: `),
  );

  const forceSearchTest =
    readlineSync
      .question("Search for 'test' and 'tests' (s/N)?: ")
      .toUpperCase() === 'S';

  do {
    page++;
    // Retrieve all Solidity repositories
    repos = await gitService.getReposByLanguage({
      language: 'Solidity',
      sort: 'stars',
      order: 'desc',
      page,
      per_page: perPage,
      additionalFilter,
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
      } else if (
        solidityRepos[r.full_name].repo.stargazers_count != r.stargazers_count
      ) {
        console.log(
          colors.magenta(
            `UPDATE STARS from ${
              solidityRepos[r.full_name].repo.stargazers_count
            } to ${r.stargazers_count}`,
          ),
        );
        solidityRepos[r.full_name].repo.stargazers_count = r.stargazers_count;
        fs.writeFileSync(filePathRepositoriesData, solidityRepos, {
          encoding: 'UTF8',
        });
      }

      // SEARCH FOR DIRECTORIES 'test' OR 'tests'
      // search only if there is no item in the results
      if (forceSearchTest) {
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
            console.log(
              r.owner.login,
              r.name,
              colors.red(searchResult.message),
            );
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
              console.log(
                r.owner.login,
                r.name,
                colors.yellow(testDir.path),
                colors.red(searchResult.message),
              );
              continue;
            }
          }
          tree.forEach(t => {
            //console.log(t.path);
            if (t.size > 0) {
              testDir.children.push(t);
            }
          });
        }
        solidityRepos[r.full_name].testTrees = searchResult;

        fs.writeFileSync(
          filePathRepositoriesData,
          JSON.stringify(solidityRepos, null, 4),
          {
            encoding: 'UTF8',
          },
        );
      }

      // SEARCH FOR FILES 'trufle.js' OR 'trufle-config.js'
      // search only if there is no item in the results
      if (
        solidityRepos[r.full_name].truffleTrees == null ||
        solidityRepos[r.full_name].truffleTrees.length == 0
      ) {
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
            console.log(
              r.owner.login,
              r.name,
              colors.red(searchResult.message),
            );
          }
        } else {
          solidityRepos[r.full_name].truffleTrees = searchResult;
        }
        solidityRepos[r.full_name].retrieveDate = new Date();
        fs.writeFileSync(
          filePathRepositoriesData,
          JSON.stringify(solidityRepos, null, 4),
          {
            encoding: 'UTF8',
          },
        );
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

  console.log(
    colors.blue(
      `${reposWithTest.length} of ${repos.items.length} repos with tests`,
    ),
  );
  reposWithTest.forEach(p => {
    console.log(p.name);
  });
}

function rollbackTrufflesConfig(repos) {
  repos.forEach(r => {
    r.truffleTrees.forEach(tt => {
      const cwd = path.join(
        targetCloneDir,
        r.repo.full_name,
        path.dirname(tt.path),
      );

      rollbackTruffleConfig(cwd);
    });
  });
}

function rollbackTruffleConfig(cwd) {
  let truffleConfigPath = null;
  if (fs.existsSync(path.join(cwd, 'truffle-config.js'))) {
    truffleConfigPath = path.join(cwd, 'truffle-config.js');
  } else if (fs.existsSync(path.join(cwd, 'truffle.js'))) {
    truffleConfigPath = path.join(cwd, 'truffle.js');
  }
  if (truffleConfigPath != null) {
    if (fs.existsSync(`${truffleConfigPath}.bkp`)) {
      fs.copyFileSync(`${truffleConfigPath}.bkp`, truffleConfigPath);
    }
    console.log(`${truffleConfigPath}.bkp`, 'APAGADO'.yellow);
  } else {
    console.log(`${truffleConfigPath} NÃO ENCONTRADO`.red);
  }
}
