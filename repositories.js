const fs = require('fs');
const path = require('path');
const colors = require('colors');
const readlineSync = require('readline-sync');

const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
const oneWeek = 7 * 24 * 60 * 60 * 1000; // days*hours*minutes*seconds*milliseconds
const oneMonth = 30 * 24 * 60 * 60 * 1000; // days*hours*minutes*seconds*milliseconds

module.exports = function repositories(solidityRepos, dateRef) {
  let functionality = readlineSync.question(`

What do you want to do?

  1. Analyse Solidity repositories local data
  2. Detail Solidity Repositories
  3. Detail truffled testable Solidity Repositories

  0. Return

  Your choice: `);

  const reposLoaded = Object.values(solidityRepos);

  if (functionality === '3') {
    detailRepos(
      reposLoaded.filter(
        sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0,
      ),
      dateRef,
    );
  } else if (functionality === '2') {
    detailRepos(reposLoaded, dateRef);
  } else if (functionality === '1') {
    showGlobalStats(solidityRepos, dateRef);
  }
  readlineSync.question('');
};

function showGlobalStats(solidityRepos, dateRef) {
  console.log(
    '#########################  REPOSITORY STATS #########################',
  );
  const reposLoaded = Object.values(solidityRepos);
  printStarStatsTable(reposLoaded, 'Total');
  printStarStatsTable(
    reposLoaded.filter(sr => sr.truffleTrees.length > 0),
    'Truffled',
  );
  printStarStatsTable(
    reposLoaded.filter(sr => sr.testTrees.length > 0),
    'Testable',
  );
  const repoTruffledWithTests = reposLoaded.filter(
    sr => sr.testTrees.length > 0 && sr.truffleTrees.length > 0,
  );
  printStarStatsTable(repoTruffledWithTests, 'Truffled Testable');
  const repoNOTruffledWithTests = reposLoaded.filter(
    sr => sr.testTrees.length > 0 && sr.truffleTrees.length == 0,
  );
  printStarStatsTable(repoNOTruffledWithTests, 'Untruffled Testable');
  // Truffled with Tests
  let qtdByExtensao = countTestFilesByExtension(
    repoTruffledWithTests,
    'Truffled With Tests',
  );
  let qtdByQtdArquivosTeste = countReposByTestFilesQuantity(
    repoTruffledWithTests,
    'Truffled With Tests',
  );
  console.log('');

  printLastPushedTimeStatsTable(reposLoaded, 'Total', dateRef);
  printLastPushedTimeStatsTable(
    reposLoaded.filter(sr => sr.truffleTrees.length > 0),
    'Truffled',
    dateRef,
  );
  printLastPushedTimeStatsTable(
    reposLoaded.filter(sr => sr.testTrees.length > 0),
    'Testable',
    dateRef,
  );
  printLastPushedTimeStatsTable(
    repoTruffledWithTests,
    'Truffled Testable',
    dateRef,
  );
  printLastPushedTimeStatsTable(
    repoNOTruffledWithTests,
    'Untruffled Testable',
    dateRef,
  );

  Object.keys(qtdByQtdArquivosTeste).forEach(qtdFiles => {
    console.log(
      `Truffle Testable - ${qtdFiles} files:`,
      qtdByQtdArquivosTeste[qtdFiles].qtdRepos,
      'repositories',
    );
  });
  console.log('');
  Object.keys(qtdByExtensao).forEach(ext => {
    console.log(
      `Truffle Testable - files ${ext} `,
      qtdByExtensao[ext].qtd,
      'files',
      qtdByExtensao[ext].qtdRepos,
      'repositories',
    );
  });
  // NO Truffled with Tests
  qtdByExtensao = countTestFilesByExtension(
    repoNOTruffledWithTests,
    'NO Truffled With Tests',
  );
  qtdByQtdArquivosTeste = countReposByTestFilesQuantity(
    repoNOTruffledWithTests,
    'NO Truffled With Tests',
  );
  console.log('');
  Object.keys(qtdByQtdArquivosTeste).forEach(qtdFiles => {
    console.log(
      `NO Truffle Testable - ${qtdFiles} files:`,
      qtdByQtdArquivosTeste[qtdFiles].qtdRepos,
      'repositories',
    );
  });
  console.log('');
  Object.keys(qtdByExtensao).forEach(ext => {
    console.log(
      `NO Truffle Testable - files ${ext} `,
      qtdByExtensao[ext].qtd,
      'files',
      qtdByExtensao[ext].qtdRepos,
      'repositories',
    );
  });
}

function detailRepos(solidityRepos, dateRef) {
  const data = {};
  let i = 0;
  for (const r of solidityRepos) {
    i += 1;
    let jsTestFiles = 0;
    let solTestFiles = 0;
    r.testTrees.forEach(t => {
      if (t.children && Array.isArray(t.children)) {
        t.children.forEach(f => {
          if (path.extname(f.path).toLowerCase() == '.js') {
            jsTestFiles += 1;
          } else if (path.extname(f.path).toLowerCase() == '.sol') {
            solTestFiles += 1;
          }
        });
      }
    });
    data[r.repo.full_name] = {
      '#': i,
      stars: r.repo.stargazers_count,
      pushed_at: r.repo.pushed_at,
      daysSince: Math.round(
        Math.abs(
          (dateRef.getTime() - new Date(r.repo.pushed_at).getTime()) / oneDay,
        ),
      ),
      testTrees: r.testTrees.length,
      JStestFiles: jsTestFiles,
      SOLtestFiles: solTestFiles,
      truffleTrees: r.truffleTrees.length,
    };
    data[r.repo.full_name]['size (MB)'] = parseFloat(
      (r.repo.size / 1024).toFixed(2),
    );
  }
  console.table(data);
}

function printStarStatsTable(dataArray, label) {
  function somaTruffleConfigs(data) {
    let count = 0;
    data.forEach(r => {
      count += r.truffleTrees.length;
    });
    return count;
  }
  const data = {};
  data[label] = {
    qtdRepositories: dataArray.length,
    qtdProjetosTruffle: somaTruffleConfigs(dataArray),
  };
  data[`${label} Starred:`] = {
    qtdRepositories: dataArray.filter(sr => sr.repo.stargazers_count > 0)
      .length,
  };
  data[`${label} 10+Stars:`] = {
    qtdRepositories: dataArray.filter(sr => sr.repo.stargazers_count >= 10)
      .length,
  };
  data[`${label} 50+Stars:`] = {
    qtdRepositories: dataArray.filter(sr => sr.repo.stargazers_count >= 50)
      .length,
  };
  data[`${label} 100+Stars:`] = {
    qtdRepositories: dataArray.filter(sr => sr.repo.stargazers_count >= 100)
      .length,
  };
  console.table(data);
}

function countTestFilesByExtension(repos) {
  const qtdByExtensao = {};

  repos.forEach(r => {
    let totalFiles = 0;
    r.testTrees.forEach(t => {
      if (t.children && Array.isArray(t.children)) {
        t.children.forEach(f => {
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
          if (
            r.repo.full_name !==
            qtdByExtensao[path.extname(f.path).toLowerCase()].ultimoRepositorio
          ) {
            qtdByExtensao[
              path.extname(f.path).toLowerCase()
            ].ultimoRepositorio = r.repo.full_name;
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

  repos.forEach(r => {
    let totalFiles = 0;
    r.testTrees.forEach(t => {
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

function printLastPushedTimeStatsTable(dataArray, label, dateRef) {
  const data = {};

  dataArray.forEach(r => {
    const monthsPassed = Math.round(
      Math.abs(
        (dateRef.getTime() - new Date(r.repo.pushed_at).getTime()) / oneMonth,
      ),
    );
    if (data[`${label} ${monthsPassed} months`] == null) {
      data[`${label} ${monthsPassed} months`] = 0;
    }
    data[`${label} ${monthsPassed} months`] += 1;
  });
  console.table(data);
}
