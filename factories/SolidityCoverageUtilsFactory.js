const colors = require('colors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ResultsQueryFactory = require('./ResultsQueryFactory');

const SolidityParser = require('./SolidityParser');

/**
 * Immutable instance with functions to execute over solidity-coverage Repositories
 *
 * @param {Array} repos Collection of github repos
 * @param {string} targetCloneDir Directory where the repositories will be cloned to
 * @param {string} filePathResearchData Path of the file where will be written the results when necessary
 * @returns {object} Objeto com utilidades para leitura de dados do arquivo da Receita Federal
 */
module.exports = function SolidityCoverageUtilsFactory({
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
    compile,
    migrate,
    test,
    executeSonarScanner,
    npmInstallInResearchProjectsList,
  });

  /**
   * Clone the repository referenced in {repos} in the position {index} and executes 'npm install' in the directory of
   * each of it's 'truffleTrees'
   *
   * @param {number} index Position of the {repos} to be cloned
   * @param {boolean} cloneNext If TRUE, when finished the clone, will call the function again passsing {index}+1
   */
  async function cloneAndInstall(index, cloneNext) {
    if (index >= repos.length) {
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
          await npmInstall(index, 0, cloneNext);
        });
      } else {
        await npmInstall(index, 0, cloneNext);
      }
    } else {
      await cloneAndInstall(index + 1, cloneNext);
    }
  }

  /**
   * Execute 'truffle compile' referenced in {repos} in the position {index}
   *
   * @param {number} index Position of the {solidityRepos} to be compiled
   * @param {number} indexTruffleTree Position of the {repos.truffleTree} to be compiled
   * @param {boolean} compileNext If TRUE, when finished the compilation, will call the function again passsing {index}+1
   * @param {boolean} onlyIfHasTestDir If TRUE, doesn't compile the project if it doesn't have a subdirectory 'test'
   */
  function compile(
    index,
    indexTruffleTree,
    compileNext,
    onlyIfHasTestDir = true,
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

          researchData[key].hasTestDir =
            fs.existsSync(path.join(cwd, 'test')) &&
            fs.lstatSync(path.join(cwd, 'test')).isDirectory() &&
            fs.readdirSync(path.join(cwd, 'test')).length > 0 &&
            (fs.readdirSync(path.join(cwd, 'test')).length > 1 ||
              fs.readdirSync(path.join(cwd, 'test'))[0] !== '.gitkeep');
          researchData[key].compileStart = new Date();
          researchData[key].compileErrors = [];
          researchData[key].compileStdErrorEvents = [];
          researchData[key].compileStdOutEvents = [];

          const solcVersion = updateTruffleConfig(cwd);
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
    }
  }

  /**
   * Execute 'truffle migrate' referenced in {researchData} in the position {index}
   *
   * @param {number} index Position of the {researchData} to be tested
   * @param {boolean} migrateNext If TRUE, when finished the migration, will call the function again passsing {index}+1
   */
  function migrate(index, migrateNext) {
    executeTruffleCommand('migrate', index, migrateNext);
  }

  /**
   * Execute 'truffle test' referenced in {researchData} in the position {index}
   *
   * @param {number} index Position of the {researchData} to be tested
   * @param {boolean} testNext If TRUE, when finished the test, will call the function again passsing {index}+1
   */
  function test(index, testNext) {
    executeTruffleCommand('test', index, testNext, 'migrate');
  }

  /**
   * Execute 'truffle <command>' referenced in {researchData} in the position {index}
   *
   * @param {string} command Truffle command to execute
   * @param {number} index Position of the {researchData} to be tested
   * @param {boolean} testNext If TRUE, when finished the command, will call the function again passsing {index}+1
   * @param {string} preRequiredSuccessfullCommand The command that has to have been executed successfully to execute the {command}
   */
  async function executeTruffleCommand(
    command,
    index,
    executeNext,
    preRequiredSuccessfullCommand = 'compile',
  ) {
    const researchData = resultsQuery.getResearchData();
    //just a break to the ganache-cli. We experimented some fail to connect. Hope this helps
    await new Promise(done => setTimeout(done, 1000));
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

        const childProcTruffle = spawn('truffle', [command], { cwd });
        // Tratamento de erro
        childProcTruffle.on('error', error => {
          researchData[key][`${command}Errors`].push(error.toString());
          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
        });

        // trata saída de erro
        childProcTruffle.stderr.on('data', data => {
          researchData[key][`${command}StdErrorEvents`].push(data.toString());
          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
        });
        // Saída padrão
        childProcTruffle.stdout.on('data', data => {
          researchData[key][`${command}StdOutEvents`].push(data.toString());
          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
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
          fs.writeFileSync(filePathResearchData, JSON.stringify(researchData), {
            encoding: 'UTF8',
          });
          if (executeNext) {
            executeTruffleCommand(
              command,
              index + 1,
              true,
              preRequiredSuccessfullCommand,
            );
          }
        });
      } else {
        if (executeNext) {
          executeTruffleCommand(
            command,
            index + 1,
            true,
            preRequiredSuccessfullCommand,
          );
        }
      }
    }
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
        const childProcNpm = spawn('npm', ['install', '--save-dev', package], {
          cwd,
        });
        // Saídas de erro e padrão
        handleChildProc(childProcNpm, key);
        // trata saída
        childProcNpm.on('exit', async (code, signal) => {
          if (code === 0 && signal == null) {
            console.log(
              colors.green(`Concluído npm install --save-dev ${package}`),
            );
          } else {
            console.warn(
              colors.red(`Erro onExit npm install --save-dev ${package}`),
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
  async function npmInstall(index, indexTruffleTree, cloneNext) {
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
          const childProcNpm = spawn('npm', ['install'], { cwd });
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
                  `Concluído npm install ${repos[index].repo.full_name}`,
                ),
              );
            } else {
              console.warn(
                colors.red(
                  `Erro onExit npm install ${repos[index].repo.full_name}`,
                ),
              );
            }
            if (cloneNext) {
              await npmInstall(index, indexTruffleTree + 1, true);
            }
          });
        } else {
          if (cloneNext) {
            await npmInstall(index, indexTruffleTree + 1, true);
          }
        }
      } else {
        await cloneAndInstall(index + 1, true);
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

function updateTruffleConfig(projectHomePath) {
  const truffleConfigPaths = ['truffle-config.js', 'truffle.js'];
  const solidityVersion = getContractsCompilerVersion(projectHomePath);
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
            /network_id:\s*"?'?\d{1,5}"?'?,/gm,
            'network_id: "*",',
          );
          // If compiler version not specified in the truffle configuration
          if (
            truffleConfigContent.indexOf('compilers') === -1 &&
            solidityVersion != null
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
