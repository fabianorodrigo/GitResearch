const colors = require('colors');
const fs = require('fs');
const path = require('path');
const readlineSync = require('readline-sync');

/**
 * Immutable instance with functions to query on the results of the research
 *
 * @param {Array} repos Collection of github repos
 * @param {string} filePathResearchData Path of the file with research data to be queried
 * @returns {object} Immutable object with query functions
 */
module.exports = function ResultsQueryFactory({ repos, filePathResearchData }) {
  let researchData = {};
  if (fs.existsSync(filePathResearchData)) {
    researchData = JSON.parse(
      fs.readFileSync(filePathResearchData, { encoding: 'UTF8' }),
    );
  }

  return Object.freeze({
    showResults,
    showErrorResults,
    getResearchData,
    getResearchScopeData,
  });

  function getResearchData() {
    if (fs.existsSync(filePathResearchData)) {
      return JSON.parse(
        fs.readFileSync(filePathResearchData, { encoding: 'UTF8' }),
      );
    } else {
      return {};
    }
  }

  /**
   *
   */
  function getResearchScopeData() {
    let result = [];
    let i = 0;

    for (const r of Object.values(researchData)) {
      if (r.testStdOutEvents != null) {
        //Passing
        const regexPassing = /(\u001b\[0m\u001b\[32m)* (\d+) passing(\u001b\[0m\u001b\[90m)* \(\d+m*s*\)/gm;
        const matchPassing = regexPassing.exec(r.testStdOutEvents.join(' '));
        // Failing
        const regexFailing = /(\d+) failing/gm;
        const matchFailing = regexFailing.exec(r.testStdOutEvents.join(' '));
        //If none match, there was problem during testing
        if (matchFailing !== null || matchPassing !== null) {
          //passing
          r.pass = 0;
          if (matchPassing != null && matchPassing.length > 2) {
            r.pass = parseInt(matchPassing[2]);
          }
          //failing
          r.fail = 0;
          if (matchFailing != null && matchFailing.length > 1) {
            r.fail = parseInt(matchFailing[1]);
          }

          //somente se não falhou o caso de teste
          if (r.fail === 0 && r.pass > 0) {
            r.index = i;
            result.push(r);
          }
        }
      }
      i += 1;
    }

    return result;
  }

  /**
   *
   */
  function showResults(
    command,
    onlyWithTestDir = false,
    successFilter,
    solcVersionFilter,
    postFilter = null,
    toCSV = false,
  ) {
    let data = {};
    let summaryDataBySolcVersion = {};
    let i = 0;
    let totalSuccessful = 0;
    let totalHasTestDir = 0;
    let scope = Object.values(researchData);
    let total = scope.length;
    //filter the projects that has testdir
    if (onlyWithTestDir) {
      scope = scope.filter(item => {
        return item.hasTestDir === true;
      });
    }
    if (solcVersionFilter) {
      scope = scope.filter(item => {
        return (
          item.solcVersion == null ||
          item.solcVersion.replace('^', '').startsWith(solcVersionFilter)
        );
      });
    }
    //filter based on the successful execution of command
    if (successFilter !== null) {
      scope = scope.filter(item => {
        return (
          (item[`${command}ExitCode`] === 0) === successFilter &&
          item[`${command}ExitCode`] != null
        );
      });
    }
    for (const r of scope) {
      let resultado = '';
      if (r[`${command}ExitCode`] !== 0 && r[`${command}StdOutEvents`]) {
        const stdOutError = r[`${command}StdOutEvents`].filter(item =>
          item.startsWith('Error'),
        );
        if (stdOutError.length > 0) {
          resultado = stdOutError[0];
          if (resultado.indexOf('\n') !== -1) {
            resultado = resultado.split('\n')[0];
          }
        }
      }
      //IF NOT SUCESS, CONSOLE ERRORS
      if (r[`${command}ExitCode`] !== 0 && r[`${command}StdOutEvents`]) {
        const msg = r[`${command}StdOutEvents`].join(' ').replace('\n', ' ');
        console.log(
          colors.yellow(r.key),
          ':',
          msg.substr(msg.indexOf('Error'), 200),
          /*.filter(item => {
              return item.indexOf('Error') > -1;
            })
            .map(item => {
              return item.split('\n')[0];
            }),*/
        );
      }

      const repo = repos.find(item => {
        return item.repo.full_name === r.full_name;
      }).repo;
      data[path.dirname(r.key)] = {
        index: i,
        repoPushed: repo.pushed_at,
        solcVersion: r.solcVersion,
        hasTestDir: r.hasTestDir,
        testScript: r.hasTestScript,
        compile:
          r[`compileExitCode`] == null ? null : r[`compileExitCode`] === 0,
        migrate:
          r[`migrateExitCode`] == null ? null : r[`migrateExitCode`] === 0,
        //tested: r[`testExitCode`] == null ? null : r[`testExitCode`] === 0, - THE EXIT CODE OF TEST IS THE NUMBER OF FAILING CASES
        //Date: r[`${command}Finish`],
      };
      if (r.testStdOutEvents != null) {
        //Passing
        const regexPassing = /(\u001b\[0m\u001b\[32m)* (\d+) passing(\u001b\[0m\u001b\[90m)* \(\d+m*s*\)/gm;
        const matchPassing = regexPassing.exec(r.testStdOutEvents.join(' '));
        // Failing
        const regexFailing = /\u001b\[0m\n\u001b\[31m  (\d+) failing\u001b\[0m/gm;
        const matchFailing = regexFailing.exec(r.testStdOutEvents.join(' '));
        //If none match, there was problem during testing
        if (matchFailing === null && matchPassing === null) {
          data[path.dirname(r.key)].test = false;
          console.log(r.key, r[`${command}StdOutEvents`]);
        } else {
          data[path.dirname(r.key)].test = true;
          //passing
          data[path.dirname(r.key)].pass = 0;
          if (matchPassing != null && matchPassing.length > 2) {
            data[path.dirname(r.key)].pass = parseInt(matchPassing[2]);
          }
          //failing
          data[path.dirname(r.key)].fail = 0;
          if (matchFailing != null && matchFailing.length > 1) {
            data[path.dirname(r.key)].fail = parseInt(matchFailing[1]);
          }
        }
      }
      i += 1;
      if (data[path.dirname(r.key)].hasTestDir) {
        totalHasTestDir += 1;
      }

      const sv = r.solcVersion != null ? r.solcVersion.replace('^', '') : '';
      if (summaryDataBySolcVersion[sv] == null) {
        summaryDataBySolcVersion[sv] = {
          success: 0,
          fail: 0,
          total: 0,
          successRate: 0,
        };
      }
      if (data[path.dirname(r.key)][command] === true) {
        totalSuccessful += 1;
        summaryDataBySolcVersion[sv].success += 1;
      } else {
        summaryDataBySolcVersion[sv].fail += 1;
      }
      summaryDataBySolcVersion[sv].total += 1;
      summaryDataBySolcVersion[sv].successRate = parseFloat(
        (
          (summaryDataBySolcVersion[sv].success /
            summaryDataBySolcVersion[sv].total) *
          100
        ).toFixed(2),
      );
    }
    //apply filter on the data results
    if (postFilter != null && postFilter.property != null) {
      Object.keys(data).forEach(prj => {
        if (
          (data[prj][postFilter.property] == null &&
            postFilter.value != null) ||
          data[prj][postFilter.property] != postFilter.value
        ) {
          delete data[prj];
          const indexToRemoveScope = scope.findIndex(
            item => path.dirname(item.key) === prj,
          );
          if (indexToRemoveScope > -1) {
            scope.splice(indexToRemoveScope, 1);
          }
        }
      });
      //reindex
      i = 0;
      Object.values(data).forEach(prj => {
        prj.index = i;
        i += 1;
      });
    }
    console.table(data);

    console.table(sortObject(summaryDataBySolcVersion));

    console.log(
      colors.yellow('Total successfull:'),
      totalSuccessful,
      '(',
      Math.round((totalSuccessful / totalHasTestDir) * 100),
      '%)',
    );
    console.log(colors.yellow('Total has test directory:'), totalHasTestDir);
    console.log(colors.yellow('Total:'), total);

    if (toCSV) {
      const header = [
        'repoPushed',
        'solcVersion',
        'hasTestDir',
        'testScript',
        'compile',
        'migrate',
        'test',
        'pass',
        'fail',
      ];
      let contentCSV = 'Project;'.concat(header.join(';')).concat('\n');
      Object.keys(data).forEach(key => {
        contentCSV += key.concat(';');
        header.forEach(atrib => {
          contentCSV += data[key][atrib] == null ? '' : data[key][atrib];
          contentCSV += ';';
        });
        contentCSV += '\n';
      });
      const filename = path.join(
        path.dirname(filePathResearchData),
        new Date().toDateString().concat('summary.csv'),
      );
      fs.writeFileSync(filename, contentCSV, {
        encoding: 'UTF8',
      });
      console.log(`${filename} written`);
    }

    return scope;
  }

  function sortObject(o) {
    var sorted = {},
      key,
      a = [];

    for (key in o) {
      if (o.hasOwnProperty(key)) {
        a.push(key);
      }
    }

    a.sort();

    for (key = 0; key < a.length; key++) {
      sorted[a[key]] = o[a[key]];
    }
    return sorted;
  }

  /**
   *
   */
  function showErrorResults(command, solcVersionFilter) {
    let summaryByErrorCause = {};
    let detailByErrorCause = {};
    let i = 0;
    let scope = Object.values(researchData);
    scope = scope.filter(item => {
      return item[`${command}ExitCode`] !== 0;
    });

    //filter the projects of a specific version
    if (solcVersionFilter) {
      scope = scope.filter(item => {
        return (
          item.solcVersion == null ||
          item.solcVersion.replace('^', '').startsWith(solcVersionFilter)
        );
      });
    }

    for (const r of scope) {
      const repo = repos.find(item => {
        return item.repo.full_name === r.full_name;
      }).repo;
      const prj = {
        index: i,
        name: path.dirname(r.key),
        repoPushed: repo.pushed_at,
        solcVersion: r.solcVersion,
        hasTestDir: r.hasTestDir,
        testScript: r.hasTestScript,
        compile:
          r[`compileExitCode`] == null ? null : r[`compileExitCode`] === 0,
        migrate:
          r[`migrateExitCode`] == null ? null : r[`migrateExitCode`] === 0,
        stdOutEvents: r[`${command}StdOutEvents`],
        //tested: r[`testExitCode`] == null ? null : r[`testExitCode`] === 0, - THE EXIT CODE OF TEST IS THE NUMBER OF FAILING CASES
        //Date: r[`${command}Finish`],
      };
      if (r.testStdOutEvents != null) {
        //Passing
        const regexPassing = /(\u001b\[0m\u001b\[32m)* (\d+) passing(\u001b\[0m\u001b\[90m)* \(\d+m*s*\)/gm;
        const matchPassing = regexPassing.exec(r.testStdOutEvents.join(' '));
        // Failing
        const regexFailing = /\u001b\[0m\n\u001b\[31m  (\d+) failing\u001b\[0m/gm;
        const matchFailing = regexFailing.exec(r.testStdOutEvents.join(' '));
        //If none match, there was problem during testing
        if (matchFailing === null && matchPassing === null) {
          prj.test = false;
          console.log(r.key, r[`${command}StdOutEvents`]);
        } else {
          prj.test = true;
          //passing
          prj.pass = 0;
          if (matchPassing != null && matchPassing.length > 2) {
            prj.pass = parseInt(matchPassing[2]);
          }
          //failing
          prj.fail = 0;
          if (matchFailing != null && matchFailing.length > 1) {
            prj.fail = parseInt(matchFailing[1]);
          }
        }
      }

      let errorCause = extractErrorCause(r[`${command}StdOutEvents`]);
      if (errorCause == null) {
        errorCause = extractErrorCause(r[`${command}StdErrorEvents`]);
      }
      if (errorCause != null) {
        if (summaryByErrorCause[errorCause] == null) {
          detailByErrorCause[errorCause] = [];
          summaryByErrorCause[errorCause] = {
            index: i,
            total: 0,
          };
          i += 1;
        }
        summaryByErrorCause[errorCause].total += 1;
        detailByErrorCause[errorCause].push(prj);
      }
    }
    let choice = null;
    while (choice != '') {
      console.table(summaryByErrorCause);
      choice = readlineSync.question(`List projects of error cause: `);
      const choiceNumber = parseInt(choice);
      const keysDetail = Object.keys(detailByErrorCause);
      if (!isNaN(choiceNumber) && choiceNumber < keysDetail.length) {
        detailByErrorCause[keysDetail[choiceNumber]].forEach(prj => {
          console.log(colors.yellow(prj.name));
          console.log(prj.stdOutEvents);
        });
        readlineSync.question(``);
      }
    }

    return scope;
  }

  function extractErrorCause(stdOutArray) {
    let retorno = '';
    if (stdOutArray != null) {
      for (const line of stdOutArray) {
        const regExDeploymentFailed = /\*\*\* Deployment Failed \*\*\*\n\n\"(.*)\" (--)?/gm;
        const msg = line.replace(regExDeploymentFailed, '');
        const regexError = /Error:(.*)/gm;
        const match = regexError.exec(msg);
        if (match != null) {
          //console.log(colors.bgYellow(match[1]));
          retorno += match[1]
            .replace(
              '/home/fabianorodrigo/Projetos/ProjetosTerceiros/github/Solidity/',
              'PRJ_HOME',
            )
            .trim()
            .split(';')[0]
            .split('- note that nightly builds')[0];
        }
      }
      if (retorno != '') return retorno;
    }
  }
};
