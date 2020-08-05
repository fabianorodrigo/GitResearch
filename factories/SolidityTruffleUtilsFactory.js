const colors = require('colors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readlineSync = require('readline-sync');

const ResultsQueryFactory = require('./ResultsQueryFactory');

const SolidityParser = require('./SolidityParser');

/**
 * Immutable instance with functions to execute over Solidity Truffle Repositories
 *
 * @param {Array} repos Collection of github repos
 * @param {string} targetCloneDir Directory where the repositories will be cloned to
 * @param {string} filePathResearchData Path of the file where will be written the results when necessary
 * @returns {object} Objeto com utilidades para leitura de dados do arquivo da Receita Federal
 */
module.exports = function SolidityTruffleUtilsFactory({
  repos,
  targetCloneDir,
  filePathResearchData,
}) {
  const resultsQuery = ResultsQueryFactory({
    repos,
    filePathResearchData,
  });

  return Object.freeze({
    cloneAndInstall,
    prepareTruffleConfig,
    compile,
    migrate,
    test,
    executeSonarScanner,
    npmInstallInResearchProjectsList,
    extractSolidityVersionFromTruffleConfigs,
  });

  /**
   * Clone the repository referenced in {repos} in the position {index} and executes 'npm install' in the directory of
   * each of it's 'truffleTrees'
   *
   * @param {number} index Position of the {repos} to be cloned
   * @param {boolean} cloneNext If TRUE, when finished the clone, will call the function again passsing {index}+1
   * @param {function} callBackFinished function to be called when the index is greater than repos.length
   */
  async function cloneAndInstall(index, cloneNext, callBackFinished) {
    if (index >= repos.length) {
      if (callBackFinished != null) {
        callBackFinished();
      }
    }
    //Clona somente quem tem truffle e testes
    else if (
      repos[index].truffleTrees.length > 0 &&
      repos[index].testTrees.length > 0
    ) {
      if (!fs.existsSync(`${targetCloneDir}/${repos[index].repo.full_name}`)) {
        const childProcGit = spawn('git', [
          'clone',
          repos[index].repo.clone_url,
          `${targetCloneDir}/${repos[index].repo.full_name}`,
        ]);
        // Saídas de erro e padrão
        handleChildProc(childProcGit, repos[index].repo.full_name);
        // trata saída
        childProcGit.on('exit', async (code, signal) => {
          if (code === 0 && signal == null) {
            console.log(
              colors.green(`Concluído Git ${repos[index].repo.full_name}`),
            );
          } else {
            console.warn(
              colors.yellow(
                `Erro onExit Git ${
                repos[index].repo.full_name
                }. Verifique o console para identificar a causa`,
              ),
            );
          }
          // npm install
          await npmInstall(index, 0, cloneNext, callBackFinished);
        });
      } else {
        await npmInstall(index, 0, cloneNext, callBackFinished);
      }
    } else {
      await cloneAndInstall(index + 1, cloneNext, callBackFinished);
    }
  }

  /**
   * Prepare the file 'truffle-config.js' of the project referenced in {repos} in the position {index}
   *
   */
  function prepareTruffleConfig() {
    const researchData = resultsQuery.getResearchData();

    repos.forEach(r => {
      r.truffleTrees.forEach(prj => {
        const key = `${r.repo.full_name}/${prj.path}`;
        const cwd = path.resolve(targetCloneDir, key, '..');

        if (fs.existsSync(cwd)) {
          if (!researchData.hasOwnProperty(key)) {
            researchData[key] = {
              key: key,
              full_name: r.repo.full_name,
              path: prj.path,
              hasPackageJSON: fs.existsSync(path.join(cwd, 'package.json')),
              repoDate: fs.statSync(cwd).ctime,
            };
          }

          researchData[key].hasTestDir =
            fs.existsSync(path.join(cwd, 'test')) &&
            fs.lstatSync(path.join(cwd, 'test')).isDirectory() &&
            fs.readdirSync(path.join(cwd, 'test')).length > 0 &&
            (fs.readdirSync(path.join(cwd, 'test')).length > 1 ||
              fs.readdirSync(path.join(cwd, 'test'))[0] !== '.gitkeep');

          if (researchData[key].hasPackageJSON === true) {
            try {
              const packageJSON = JSON.parse(
                fs.readFileSync(path.join(cwd, 'package.json')),
              );
              researchData[key].hasTestScript =
                packageJSON.scripts &&
                packageJSON.scripts.test &&
                packageJSON.scripts.test.indexOf('no test specified') == -1;
            } catch (e) {
              console.log(
                colors.red(`Fail to read ${cwd}/package.json: ${key}`),
                e.message,
              );
              readlineSync.question(``);
              researchData[key].hasTestScript = false;
            }
          }
          //backup truffle-config.js and truffle.js
          const truffleConfigPath = path.join(targetCloneDir, key);
          if (!fs.existsSync(`${truffleConfigPath}.bkp`)) {
            fs.copyFileSync(truffleConfigPath, `${truffleConfigPath}.bkp`);
          }
          if (
            fs.existsSync(path.join(cwd, 'truffle.js')) &&
            !fs.existsSync(path.join(cwd, 'truffle.js.bkp'))
          ) {
            fs.renameSync(
              path.join(cwd, 'truffle.js'),
              path.join(cwd, 'truffle.js.bkp'),
            );
          }

          let compilersSection = extractSectionFromTruffleConfig(
            truffleConfigPath,
            'compilers',
          );
          if (compilersSection == null || compilersSection == '') {
            const solidityVersion = getContractsCompilerVersion(cwd);
            compilersSection = `compilers: {
    solc: {
      version: "${
              solidityVersion == null ? '0.5.10' : solidityVersion.replace('^', '')
              }",
    }
  }`;
            researchData[key].solcVersion =
              solidityVersion == null ? '0.5.10' : solidityVersion;
          } else {
            //If has compiler version but it is commented (some truffle-config.js has this pattern)
            if (compilersSection.indexOf('// version: "') > -1) {
              const ini = compilersSection.indexOf('// version: "');
              compilersSection =
                compilersSection.substr(0, ini - 1) +
                compilersSection.substr(ini + 2);
            }
            const settings = { compilers: { solc: { version: '0.5.10' } } };
            const truffleConfigJSON = eval('({' + compilersSection + '})');
            if (
              truffleConfigJSON.compilers &&
              truffleConfigJSON.compilers.solc
            ) {
              researchData[key].solcVersion =
                truffleConfigJSON.compilers.solc.version;
            }
            if (researchData[key].solcVersion === './node_modules/solc') {
              let packageJSONsolc = JSON.parse(
                fs.readFileSync(
                  path.join(cwd, './node_modules/solc/package.json'),
                  { encoding: 'UTF8' },
                ),
              );
              if (packageJSONsolc.version) {
                researchData[key].solcVersion = packageJSONsolc.version;
              }
            }
          }

          let newTruffleConfigContent = `module.exports = {
    networks: {
        development: {
          host: 'localhost',
          port: 8545,
          network_id: '*' // eslint-disable-line camelcase
        },
        coverage: {
          host: 'localhost',
          network_id: '*', // eslint-disable-line camelcase
          port: 8555,
          gas: 0xfffffffffff,
          gasPrice: 0x01
        }
    },${compilersSection}
};`;
          fs.writeFileSync(truffleConfigPath, newTruffleConfigContent, {
            encoding: 'UTF8',
          });

          //extract compilers configuration
          //console.log(colors.blue(researchData[key]));
          //console.log(newTruffleConfigContent);

          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
        }
      });
    });
  }

  /**
   * Execute 'truffle compile' referenced in {repos} in the position {index}
   *
   * @param {number} index Position of the {solidityRepos} to be compiled
   * @param {number} indexTruffleTree Position of the {repos.truffleTree} to be compiled
   * @param {boolean} compileNext If TRUE, when finished the compilation, will call the function again passsing {index}+1
   * @param {boolean} onlyIfHasTestDir If TRUE, doesn't compile the project if it doesn't have a subdirectory 'test'
   * @param {string} forcedSolcVersion If informed, the function won't try to discover the version of solidity in files, use it
   * @param {function} callBackFinished function to be called when the index is greater than repos.length
   */
  function compile(
    index,
    indexTruffleTree,
    compileNext,
    onlyIfHasTestDir = true,
    forcedSolcVersion = null,
    callBackFinished,
  ) {
    const researchData = resultsQuery.getResearchData();
    if (index < repos.length) {
      if (indexTruffleTree < repos[index].truffleTrees.length) {
        const t = repos[index].truffleTrees[indexTruffleTree];
        const key = `${repos[index].repo.full_name}/${t.path}`;

        const cwd = path.resolve(targetCloneDir, key, '..');

        if (fs.existsSync(cwd)) {
          if (!researchData.hasOwnProperty(key)) {
            researchData[key] = {
              key: key,
              full_name: repos[index].repo.full_name,
              path: t.path,
              hasPackageJSON: fs.existsSync(path.join(cwd, 'package.json')),
              repoDate: fs.statSync(cwd).ctime,
            };
          }
          console.log(new Date(), index, indexTruffleTree, key);

          researchData[key].hasTestDir =
            fs.existsSync(path.join(cwd, 'test')) &&
            fs.lstatSync(path.join(cwd, 'test')).isDirectory() &&
            fs.readdirSync(path.join(cwd, 'test')).length > 0 &&
            (fs.readdirSync(path.join(cwd, 'test')).length > 1 ||
              fs.readdirSync(path.join(cwd, 'test'))[0] !== '.gitkeep');

          if (researchData[key].hasPackageJSON === true) {
            try {
              const packageJSON = JSON.parse(
                fs.readFileSync(path.join(cwd, 'package.json')),
              );
              researchData[key].hasTestScript =
                packageJSON.scripts &&
                packageJSON.scripts.test &&
                packageJSON.scripts.test.indexOf('no test specified') == -1;
            } catch (e) {
              console.log(colors.red(`Fail to read package.json: ${key}`));
              researchData[key].hasTestScript = false;
            }
          }
          researchData[key].compileStart = new Date();
          researchData[key].compileErrors = [];
          researchData[key].compileStdErrorEvents = [];
          researchData[key].compileStdOutEvents = [];

          const solcVersion = updateTruffleConfig(cwd, forcedSolcVersion);
          if (solcVersion != null) {
            researchData[key].solcVersion = solcVersion;
          }
          if (!onlyIfHasTestDir || researchData[key].hasTestDir) {
            const childProcTruffle = spawn('truffle', ['compile'], { cwd });
            // Tratamento de erro
            childProcTruffle.on('error', error => {
              researchData[key].compileErrors.push(error.toString());
              fs.writeFileSync(
                filePathResearchData,
                JSON.stringify(researchData),
                {
                  encoding: 'UTF8',
                },
              );
            });

            // trata saída de erro
            childProcTruffle.stderr.on('data', data => {
              researchData[key].compileStdErrorEvents.push(data.toString());
              fs.writeFileSync(
                filePathResearchData,
                JSON.stringify(researchData),
                {
                  encoding: 'UTF8',
                },
              );
            });
            // Saída padrão
            childProcTruffle.stdout.on('data', data => {
              researchData[key].compileStdOutEvents.push(data.toString());
              fs.writeFileSync(
                filePathResearchData,
                JSON.stringify(researchData),
                {
                  encoding: 'UTF8',
                },
              );
            });
            // trata saída
            childProcTruffle.on('exit', async (code, signal) => {
              researchData[key].compileFinish = new Date();
              researchData[key].compileExitCode = code;
              researchData[key].compileExitSignal = signal;
              if (code === 0 && signal == null) {
                console.log(colors.green(`Compile completed ${cwd}`));
              } else {
                console.warn(
                  colors.yellow(
                    `Erro onExit compile ${cwd}. Verifique o console para identificar a causa`,
                  ),
                );
              }
              fs.writeFileSync(
                filePathResearchData,
                JSON.stringify(researchData),
                {
                  encoding: 'UTF8',
                },
              );
              if (compileNext) {
                compile(index, indexTruffleTree + 1, true);
              }
            });
          } else {
            console.log(colors.red(`${cwd} has no test directory`));
            if (compileNext) {
              compile(index, indexTruffleTree + 1, true);
            }
          }
        } else {
          console.log(colors.red(`${cwd} does not exists`));
          if (compileNext) {
            compile(index, indexTruffleTree + 1, true);
          }
        }
      } else {
        if (compileNext) {
          compile(index + 1, 0, true);
        }
      }
    } else {
      if (callBackFinished != null) {
        callBackFinished();
      }
    }
  }

  /**
   * Execute 'truffle migrate' referenced in {researchData} in the position {index}
   *
   * @param {number} index Position of the {researchData} to be tested
   * @param {boolean} migrateNext If TRUE, when finished the migration, will call the function again passsing {index}+1
   * @param {boolean} dontExecuteIfPreviousExecutionSucceded If TRUE the result of {command} in the {researchData} is success, won't execute again (default = FALSE)
   * @param {function} callBackFinished function to be called when the index is greater than repos.length
   */
  function migrate(
    index,
    migrateNext,
    dontExecuteIfPreviousExecutionSucceded = false,
    callBackFinished,
  ) {
    executeTruffleCommand(
      'migrate',
      index,
      migrateNext,
      'compile',
      dontExecuteIfPreviousExecutionSucceded,
      callBackFinished,
    );
  }

  /**
   * Execute 'truffle test' referenced in {researchData} in the position {index}
   *
   * @param {number} index Position of the {researchData} to be tested
   * @param {boolean} testNext If TRUE, when finished the test, will call the function again passsing {index}+1
   * @param {boolean} dontExecuteIfPreviousExecutionSucceded If TRUE the result of {command} in the {researchData} is success, won't execute again (default = FALSE)
   * @param {function} callBackFinished function to be called when the index is greater than repos.length
   */
  function test(
    index,
    testNext,
    dontExecuteIfPreviousExecutionSucceded = false,
    callBackFinished,
  ) {
    executeTruffleCommand(
      'test',
      index,
      testNext,
      'migrate',
      dontExecuteIfPreviousExecutionSucceded,
      callBackFinished,
    );
  }

  /**
   * Execute 'truffle <command>' referenced in {researchData} in the position {index}
   *
   * @param {string} command Truffle command to execute
   * @param {number} index Position of the {researchData} to be tested
   * @param {boolean} testNext If TRUE, when finished the command, will call the function again passsing {index}+1
   * @param {string} preRequiredSuccessfullCommand The command that has to have been executed successfully to execute the {command}
   * @param {boolean} dontExecuteIfPreviousExecutionSucceded If TRUE the result of {command} in the {researchData} is success, won't execute again (default = FALSE)
   * @param {function} callBackFinished function to be called when the index is greater than repos.length
   */
  async function executeTruffleCommand(
    command,
    index,
    executeNext,
    preRequiredSuccessfullCommand = 'compile',
    dontExecuteIfPreviousExecutionSucceded = false,
    callBackFinished,
  ) {
    function next() {
      if (executeNext) {
        executeTruffleCommand(
          command,
          index + 1,
          true,
          preRequiredSuccessfullCommand,
          dontExecuteIfPreviousExecutionSucceded,
        );
      }
    }

    const researchData = resultsQuery.getResearchData();
    const researchDataKeys = Object.keys(researchData);
    if (index < researchDataKeys.length) {
      const key = researchDataKeys[index];
      const cwd = path.resolve(targetCloneDir, key, '..');

      if (
        dontExecuteIfPreviousExecutionSucceded === true &&
        wasCommandExecutedSuccessfully(researchData[key], command) != false
      ) {
        next();
      } else {
        //just a break to the ganache-cli. We experimented some fail to connect. Hope this helps
        await new Promise(done => setTimeout(done, 5000));

        delete researchData[key][`${command}Start`];
        delete researchData[key][`${command}Errors`];
        delete researchData[key][`${command}StdErrorEvents`];
        delete researchData[key][`${command}StdOutEvents`];

        console.log(new Date(), index, key);

        //the directory of the project has to exist
        //it have to have a subdirectory 'test'
        //if the command is not 'compile', it has to have been compiled sucessfully
        if (
          fs.existsSync(cwd) &&
          researchData[key].hasTestDir === true &&
          (command == preRequiredSuccessfullCommand ||
            researchData[key][`${preRequiredSuccessfullCommand}ExitCode`] === 0)
        ) {
          researchData[key][`${command}Start`] = new Date();
          researchData[key][`${command}Errors`] = [];
          researchData[key][`${command}StdErrorEvents`] = [];
          researchData[key][`${command}StdOutEvents`] = [];

          console.log(`${command} started on ${cwd}`);
          //if it is executing test and has a test script, run test script
          const childProcTruffle =
            command == 'test' && researchData[key].hasTestScript == true
              ? spawn('pnpm', ['run', command], { cwd })
              : spawn('truffle', [command], { cwd });
          // Tratamento de erro
          childProcTruffle.on('error', error => {
            researchData[key][`${command}Errors`].push(error.toString());
            fs.writeFileSync(
              filePathResearchData,
              JSON.stringify(researchData),
              {
                encoding: 'UTF8',
              },
            );
          });

          // trata saída de erro
          childProcTruffle.stderr.on('data', data => {
            researchData[key][`${command}StdErrorEvents`].push(data.toString());
            fs.writeFileSync(
              filePathResearchData,
              JSON.stringify(researchData),
              {
                encoding: 'UTF8',
              },
            );
          });
          // Saída padrão
          childProcTruffle.stdout.on('data', data => {
            researchData[key][`${command}StdOutEvents`].push(data.toString());
            fs.writeFileSync(
              filePathResearchData,
              JSON.stringify(researchData),
              {
                encoding: 'UTF8',
              },
            );
          });
          // trata saída
          childProcTruffle.on('exit', async (code, signal) => {
            researchData[key][`${command}Finish`] = new Date();
            researchData[key][`${command}ExitCode`] = code;
            researchData[key][`${command}ExitSignal`] = signal;
            if (code === 0 && signal == null) {
              console.log(colors.green(`${command} completed ${cwd}`));
            } else {
              console.warn(colors.yellow(`Erro onExit ${command} ${cwd}`));
              //if not batch, can be verbose
              if (!executeNext) {
                console.warn(
                  resultsQuery.getResearchData()[researchDataKeys[index]],
                );
                console.log(index, colors.yellow(researchDataKeys[index]));
              }
            }
            fs.writeFileSync(
              filePathResearchData,
              JSON.stringify(researchData),
              {
                encoding: 'UTF8',
              },
            );
            next();
          });
        } else {
          next();
        }
      }
    } else {
      if (callBackFinished != null) {
        callBackFinished();
      }
    }
  }

  /**
   * Extract from the truffle-config.js the string declared as the section name wanted
   *
   * @param {string} truffleConfigPath Path of truffle-config.js
   * @param {string} sectionName Name of the section wanted
   *
   * @returns {string} The text representing the section with the same name as {sectionName}
   */
  function extractSectionFromTruffleConfig(truffleConfigPath, sectionName) {
    //the file has to exist
    if (fs.existsSync(truffleConfigPath)) {
      try {
        let truffleconfigFile = fs
          .readFileSync(truffleConfigPath, { encoding: 'UTF8' })
          .replace(`${sectionName} :`, `${sectionName}:`);

        //Take just after module.exports
        truffleconfigFile = truffleconfigFile.substr(
          truffleconfigFile.indexOf(`${sectionName}:`),
        );
        let countBrackets = null;
        let indexBrackets = truffleconfigFile.indexOf('{');
        while (indexBrackets != -1 && countBrackets !== 0) {
          if (truffleconfigFile[indexBrackets] === '{') {
            countBrackets += 1;
          } else if (truffleconfigFile[indexBrackets] === '}') {
            countBrackets -= 1;
          }
          indexBrackets += 1;
        }
        return truffleconfigFile.substring(0, indexBrackets);
      } catch (e) {
        console.error(`Fail on ${cwd}: ${e.message}`);
        countFails += 1;
      }
    }
  }

  /**
   * Extract the solidity version of truffle-config.js files (It won't check the researchData.json file)
   *
   * @param {string} command Truffle command to execute
   * @param {number} index Position of the {researchData} to be tested
   * @param {boolean} testNext If TRUE, when finished the command, will call the function again passsing {index}+1
   * @param {string} preRequiredSuccessfullCommand The command that has to have been executed successfully to execute the {command}
   * @param {boolean} dontExecuteIfPreviousExecutionSucceded If TRUE the result of {command} in the {researchData} is success, won't execute again (default = FALSE)
   */
  function extractSolidityVersionFromTruffleConfigs() {
    const researchData = resultsQuery.getResearchData();
    const researchDataKeys = Object.keys(researchData);
    const data = {};
    let truffleConfigJSON;
    let countFails = 0;

    researchDataKeys.forEach(key => {
      const cwd = path.resolve(targetCloneDir, key);
      //the directory of the project has to exist
      //it have to have a subdirectory 'test'
      if (fs.existsSync(cwd) && researchData[key].hasTestDir === true) {
        try {
          let truffleconfigFile = fs
            .readFileSync(cwd, { encoding: 'UTF8' })
            .replace('compilers :', 'compilers:');

          //Take just after module.exports
          truffleconfigFile = truffleconfigFile.substr(
            truffleconfigFile.indexOf('compilers:'),
          );
          let countBrackets = null;
          let indexBrackets = truffleconfigFile.indexOf('{');
          while (indexBrackets != -1 && countBrackets !== 0) {
            if (truffleconfigFile[indexBrackets] === '{') {
              countBrackets += 1;
            } else if (truffleconfigFile[indexBrackets] === '}') {
              countBrackets -= 1;
            }
            indexBrackets += 1;
          }

          truffleConfigJSON = eval(
            '({' + truffleconfigFile.substring(0, indexBrackets) + '})',
          );
          data[path.dirname(key)] = {
            solcVersionTruffleConfig: truffleConfigJSON.compilers.solc.version,
          };
          if (
            data[path.dirname(key)].solcVersionTruffleConfig ===
            './node_modules/solc'
          ) {
            let packageJSONsolc = JSON.parse(
              fs.readFileSync(
                path.join(
                  path.dirname(cwd),
                  './node_modules/solc/package.json',
                ),
                { encoding: 'UTF8' },
              ),
            );
            if (packageJSONsolc.version) {
              data[path.dirname(key)] = {
                solcVersionTruffleConfig: packageJSONsolc.version.concat('*'),
              };
            }
          }
          data[path.dirname(key)].solcResearchData =
            researchData[key].solcVersion;
          if (
            data[path.dirname(key)].solcResearchData.replace('^', '') !=
            data[path.dirname(key)].solcVersionTruffleConfig
          ) {
            data[path.dirname(key)].diff = true;
          }
        } catch (e) {
          console.error(`Fail on ${cwd}: ${e.message}`);
          countFails += 1;
        }
      }
    });
    console.log('Fails:', countFails);
    return data;
  }

  /**
   * Check in the data about the Truffle Project if the command (compile, migrate or test) was executed successfully
   * For compile and migrate, it's checked only if the ExitCode is equal zero. In case of 'test' command, the ExitCode
   * returned is the number of test cases that fail. Since the objective of this method is to check if the test was started not if all
   * the results expected returned, a regular expression is used in the StdOutEvents to check if it was executed
   * @param {object} researchDataProject Object with data about Truffle Project
   * @param {string} command The Truffle command under evaluation
   * @returns {boolean} TRUE if the command was executed sucessfully (in case of 'test', the results of execution are not considered. Only if it was executed)
   */
  function wasCommandExecutedSuccessfully(researchDataProject, command) {
    if (researchDataProject.ignore == true) {
      return null;
    }
    if (command.toLowerCase() === 'test') {
      if (researchDataProject.testStdOutEvents != null) {
        //Passing
        const regexPassing = /(\u001b\[0m\u001b\[32m)* (\d+) passing(\u001b\[0m\u001b\[90m)* \(\d+m*s*\)/gm;
        const matchPassing = regexPassing.exec(
          researchDataProject.testStdOutEvents.join(' '),
        );
        // Failing
        const regexFailing = /\u001b\[0m\n\u001b\[31m  (\d+) failing\u001b\[0m/gm;
        const matchFailing = regexFailing.exec(
          researchDataProject.testStdOutEvents.join(' '),
        );
        //If none match, there was problem during testing
        if (matchFailing === null && matchPassing === null) {
          return false;
        } else {
          return true;
        }
      }
    } else {
      return researchDataProject[`${command}ExitCode`] === 0;
    }
    return false;
  }

  /**
   * Execute 'sonar-scanner' referenced in {researchData} in the position {index}
   *
   * @param {number} index Position of the {researchData} to be executed
   * @param {boolean} executeNext If TRUE, when finished the command, will call the function again passsing {index}+1
   */
  function executeSonarScanner(index, executeNext) {
    const command = 'sonarScanner';
    const researchDataKeys = Object.keys(researchData);
    if (index < researchDataKeys.length) {
      const key = researchDataKeys[index];
      const cwd = path.resolve(targetCloneDir, key, '..');

      delete researchData[key][`${command}Start`];
      delete researchData[key][`${command}Errors`];
      delete researchData[key][`${command}StdErrorEvents`];
      delete researchData[key][`${command}StdOutEvents`];

      //the directory of the project has to exist
      //it have to have a subdirectory 'test'
      //it has to have been tested sucessfully all it's test cases (textExitCode == 0)
      if (
        fs.existsSync(cwd) &&
        researchData[key].hasTestDir === true &&
        researchData[key][`testExitCode`] === 0
      ) {
        researchData[key][`${command}Start`] = new Date();
        researchData[key][`${command}Errors`] = [];
        researchData[key][`${command}StdErrorEvents`] = [];
        researchData[key][`${command}StdOutEvents`] = [];

        //Creating config file
        const contentSonarProject = `
# must be unique in a given SonarQube instance
sonar.projectKey=${path.dirname(key, '..').replace(/\//g, ':')}
# this is the name and version displayed in the SonarQube UI. Was mandatory prior to SonarQube 6.1.
sonar.projectName=${path.dirname(key, '..').replace(/\//g, '_')}
sonar.projectVersion=1.0

# Path is relative to the sonar-project.properties file. Replace "\" by "/" on Windows.
# This property is optional if sonar.modules is set.
sonar.sources=./contracts

# Encoding of the source code. Default is default system encoding
#sonar.sourceEncoding=UTF-8`;
        fs.writeFileSync(
          path.join(cwd, 'sonar-project.properties'),
          contentSonarProject,
          { encoding: 'UTF-8' },
        );

        const childProcSonarScanner = spawn('sonar-scanner', [], { cwd });
        // Tratamento de erro
        childProcSonarScanner.on('error', error => {
          researchData[key][`${command}Errors`].push(error.toString());
          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
        });

        // trata saída de erro
        childProcSonarScanner.stderr.on('data', data => {
          researchData[key][`${command}StdErrorEvents`].push(data.toString());
          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
        });
        // Saída padrão
        childProcSonarScanner.stdout.on('data', data => {
          researchData[key][`${command}StdOutEvents`].push(data.toString());
          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
        });
        // trata saída
        childProcSonarScanner.on('exit', async (code, signal) => {
          researchData[key][`${command}Finish`] = new Date();
          researchData[key][`${command}ExitCode`] = code;
          researchData[key][`${command}ExitSignal`] = signal;
          if (code === 0 && signal == null) {
            console.log(colors.green(`${command} completed ${cwd}`));
          } else {
            console.warn(colors.yellow(`Erro onExit ${command} ${cwd}`));
          }
          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
          if (executeNext) {
            executeSonarScanner(index + 1, true);
          }
        });
      } else {
        if (executeNext) {
          executeSonarScanner(index + 1, true);
        }
      }
    }
  }

  /**
   * Execute 'npm install --save-dev {package}' in the directory of the project which index is in the first position of array {list}
   *
   * @param {Array} list List of positions of projects in the {researchData}
   * @param {string} package Name of the package to be installed
   */
  async function npmInstallInResearchProjectsList(list, package) {
    const researchDataKeys = Object.keys(researchData);
    if (list.length > 0) {
      const key = researchDataKeys[list[0]];
      const cwd = path.resolve(targetCloneDir, key, '..');

      //the directory of the project has to exist
      //it have to have a subdirectory 'test'
      if (fs.existsSync(cwd) && researchData[key].hasTestDir === true) {
        const childProcNpm = spawn('pnpm', ['install', '--save-dev', package], {
          cwd,
        });
        // Saídas de erro e padrão
        handleChildProc(childProcNpm, key);
        // trata saída
        childProcNpm.on('exit', async (code, signal) => {
          if (code === 0 && signal == null) {
            console.log(
              colors.green(`Concluído pnpm install --save-dev ${package}`),
            );
          } else {
            console.warn(
              colors.red(`Erro onExit pnpm install --save-dev ${package}`),
            );
          }
          if (list.length > 1) {
            list.shift();
            await npmInstallInResearchProjectsList(list, package);
          }
        });
      } else {
        if (list.length > 1) {
          list.shift();
          await npmInstallInResearchProjectsList(list, package);
        }
      }
    }
  }

  /**
   * Execute 'npm install' in the directory of the truffle-config.js referenced in the position {indexTruffleTree} of attribute 'truffleTrees'
   * of the repository referenced in {repos} in the position {index}
   *
   * @param {number} index Position of the repository in {repos}
   * @param {number} indexTruffleTree Position of the truffle-config.js in the {repos[index].truffleTrees}
   * @param {boolean} cloneNext If TRUE, when finished the clone, will call the function again passsing {index}+1
   */
  async function npmInstall(
    index,
    indexTruffleTree,
    cloneNext,
    callBackFinished,
  ) {
    const researchData = resultsQuery.getResearchData();
    if (index < repos.length) {
      if (indexTruffleTree < repos[index].truffleTrees.length) {
        const t = repos[index].truffleTrees[indexTruffleTree];
        const key = `${repos[index].repo.full_name}/${t.path}`;

        const cwd = path.resolve(targetCloneDir, key, '..');

        researchData[key] = {
          key: key,
          full_name: repos[index].repo.full_name,
          path: t.path,
          hasPackageJSON: fs.existsSync(path.join(cwd, 'package.json')),
          npmInstallExitCode: null,
          npmInstallStart: new Date(),
        };

        if (
          fs.existsSync(cwd) &&
          fs.existsSync(path.join(cwd, 'package.json')) &&
          !fs.existsSync(path.join(cwd, 'node_modules'))
        ) {
          const childProcNpm = spawn('pnpm', ['install'], { cwd });
          // Saídas de erro e padrão
          handleChildProc(childProcNpm, repos[index].repo.full_name);
          // trata saída
          childProcNpm.on('exit', async (code, signal) => {
            researchData[key].npmInstallExitCode = code;
            if (code === 0 && signal == null) {
              fs.writeFileSync(
                filePathResearchData,
                JSON.stringify(researchData),
                {
                  encoding: 'UTF8',
                },
              );
              console.log(
                colors.green(
                  `Concluído pnpm install ${repos[index].repo.full_name}`,
                ),
              );
            } else {
              console.warn(
                colors.red(
                  `Erro onExit pnpm install ${repos[index].repo.full_name}`,
                ),
              );
            }
            if (cloneNext) {
              await npmInstall(
                index,
                indexTruffleTree + 1,
                true,
                callBackFinished,
              );
            }
          });
        } else {
          if (cloneNext) {
            await npmInstall(
              index,
              indexTruffleTree + 1,
              true,
              callBackFinished,
            );
          }
        }
      } else {
        await cloneAndInstall(index + 1, true, callBackFinished);
      }
    }
  }

  function handleChildProc(childProc, repoFullName) {
    // Tratamento de erro
    childProc.on('error', error => {
      console.error(colors.red(`${repoFullName} Falhou no onError`), error);
    });

    // trata saída de erro
    childProc.stderr.on('data', data => {
      data = data.toString().split(/(\r?\n)/g);
      data.forEach((item, i) => {
        if (data[i] !== '\n' && data[i] !== '') {
          console.error(
            colors.yellow(`${repoFullName}`),
            colors.yellow(data[i]),
          );
        }
      });
    });
    // Saída padrão
    childProc.stdout.on('data', data => {
      data = data.toString().split(/(\r?\n)/g);
      data.forEach((item, i) => {
        if (data[i] !== '\n' && data[i] !== '') {
          console.log(repoFullName, data[i]);
        }
      });
    });
  }
};

function updateTruffleConfig(projectHomePath, forcedSolcVersion) {
  const truffleConfigPaths = ['truffle-config.js', 'truffle.js'];
  const solidityVersion =
    forcedSolcVersion == null
      ? getContractsCompilerVersion(projectHomePath)
      : forcedSolcVersion;
  try {
    for (let truffleConfigPath of truffleConfigPaths) {
      if (fs.existsSync(path.join(projectHomePath, truffleConfigPath))) {
        truffleConfigPath = path.join(projectHomePath, 'truffle-config.js');

        let truffleConfigContent = '';
        //size of default content with none property set
        if (fs.statSync(truffleConfigPath).size === 135) {
          truffleConfigContent = `module.exports = {
 networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    }
  },
  compilers: {
    solc: {
      version: "${
            solidityVersion == null ? '0.5.10' : solidityVersion.replace('^', '')
            }",
    }
  }
};`;
        } else {
          truffleConfigContent = fs.readFileSync(truffleConfigPath, {
            encoding: 'UTF8',
          });

          //replace the port numbers to 8545
          truffleConfigContent = truffleConfigContent.replace(
            /port:\s*\d{4,5},/gm,
            'port: 8545,',
          );
          //replace the network_i to *
          truffleConfigContent = truffleConfigContent.replace(
            /network_id:\s*"?'?\d{1,5}"?'?/gm,
            'network_id: "*"',
          );
          // If compiler version not specified in the truffle configuration
          // it was found the solidity version in the .sol files
          // and the truffle-config.js file has at least a '}' char (otherwise, it is made of require)
          if (
            truffleConfigContent.indexOf('compilers') === -1 &&
            solidityVersion != null &&
            truffleConfigContent.lastIndexOf('}') > -1
          ) {
            let compiler = `
  compilers: {
    solc: {
      version: "${solidityVersion.replace('^', '')}",
    }
  }
  `;
            let position = truffleConfigContent.lastIndexOf('}') - 1;
            let lastNotSpaceCharacter = null;

            while (lastNotSpaceCharacter == null) {
              //if is not a 'empty' space and the line is not commented
              if (
                [' ', '\n', '\r', '\t'].findIndex(
                  char => char === truffleConfigContent[position],
                ) === -1
              ) {
                const startCurrentLine =
                  truffleConfigContent.lastIndexOf('\n', position) + 1;
                const currentLine = truffleConfigContent
                  .substring(
                    startCurrentLine,
                    truffleConfigContent.indexOf('\n', startCurrentLine + 1),
                  )
                  .trim();
                //if not commented
                if (currentLine[0] === '/' && currentLine[1] === '/') {
                  position = startCurrentLine;
                } else {
                  lastNotSpaceCharacter = truffleConfigContent[position];
                }
              }
              if (lastNotSpaceCharacter == null) {
                position = position - 1;
              }
            }
            if (
              (truffleConfigContent.match(new RegExp('}', 'g')) || []).length >
              1 &&
              (lastNotSpaceCharacter === '}' || lastNotSpaceCharacter === `'`)
            ) {
              compiler = ',\n'.concat(compiler);
            }
            truffleConfigContent = [
              truffleConfigContent.slice(0, position + 1),
              compiler,
              truffleConfigContent.slice(position + 1),
            ].join('');
          }
          //If has compiler version but it is commented (some truffle-config.js has this pattern)
          else if (
            truffleConfigContent.indexOf('compilers') > -1 &&
            truffleConfigContent.indexOf(
              '// version: "',
              truffleConfigContent.indexOf('compilers'),
            ) > -1
          ) {
            const ini = truffleConfigContent.indexOf(
              '// version: "',
              truffleConfigContent.indexOf('compilers'),
            );
            truffleConfigContent =
              truffleConfigContent.substr(0, ini - 1) +
              truffleConfigContent.substr(ini + 2);
          }
        }
        if (!fs.existsSync(`${truffleConfigPath}.bkp`)) {
          fs.copyFileSync(truffleConfigPath, `${truffleConfigPath}.bkp`);
        }
        fs.writeFileSync(truffleConfigPath, truffleConfigContent, {
          encoding: 'UTF8',
        });
      }
    }
  } catch (e) {
    console.log(colors.red(e.message), e);
  }
  return solidityVersion;
}

function getContractsCompilerVersion(projectHomePath) {
  const contractsDir = path.join(projectHomePath, 'contracts');
  if (fs.existsSync(contractsDir)) {
    const solidityFiles = getAllSolidityFiles(contractsDir);
    let versions = [];
    let greatestVersion = null;
    let xyzGreatestVersion = null;
    for (const solFile of solidityFiles) {
      versions = SolidityParser.getSolidityVersions(solFile);
      if (versions != null && versions.length > 0) {
        for (const version of versions) {
          if (version.name === 'solidity') {
            const regex = /(\^?\d+.\d+.\d+)/gm;
            const regexResult = regex.exec(version.value);
            if (regexResult != null && regexResult.length > 1) {
              const xyzVersionFound = regexResult[1].split('.');
              xyzVersionFound[0] = xyzVersionFound[0].replace('^', '');
              if (
                greatestVersion == null ||
                parseInt(xyzVersionFound[0]) > xyzGreatestVersion[0] ||
                parseInt(xyzVersionFound[1]) > xyzGreatestVersion[1] ||
                parseInt(xyzVersionFound[2]) > xyzGreatestVersion[2]
              ) {
                greatestVersion = regexResult[1];
                xyzGreatestVersion = greatestVersion.split('.');
                xyzGreatestVersion[0] = parseInt(
                  xyzGreatestVersion[0].replace('^', ''),
                );
                xyzGreatestVersion[1] = parseInt(xyzGreatestVersion[1]);
                xyzGreatestVersion[2] = parseInt(xyzGreatestVersion[2]);
              }
            }
          }
        }
      }
    }
    return greatestVersion;
  } else {
    console.log(`${contractsDir} NOT FOUND`.bgYellow);
  }
}

function getAllSolidityFiles(contractsDir) {
  let result = [];
  const items = fs.readdirSync(contractsDir);
  for (const fileSol of items) {
    const itemPath = path.join(contractsDir, fileSol);
    if (fs.lstatSync(itemPath).isDirectory()) {
      result = result.concat(getAllSolidityFiles(itemPath));
    } else if (path.extname(fileSol).toLowerCase() === '.sol') {
      result.push(itemPath);
    }
  }
  return result;
}
