const colors = require('colors');
const fs = require('fs');

/**
 * Immutable instance with functions to execute over Solidity Truffle Repositories
 *
 * @param {Array} repos Collection of github repos
 * @param {string} targetCloneDir Directory where the repositories will be cloned to
 * @returns {object} Objeto com utilidades para leitura de dados do arquivo da Receita Federal
 */
module.exports = function SolidityTruffleUtilsFactory({
  repos,
  targetCloneDir,
}) {
  return Object.freeze({
    cloneAndInstall,
  });

  /**
   * Clone the repository referenced in {repos} in the position {index} and executes 'npm install' in the directory of
   * each of it's 'truffleTrees'
   *
   * @param {number} index Position of the {repos} to be cloned
   * @param {boolean} cloneNext If TRUE, when finished the clone, will call the function again passsing {index}+1
   */
  function cloneAndInstall(index, cloneNext) {
    if (index >= repos.length) {
    } else {
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
          npmInstall(repos, index, 0, cloneNext);
        });
      } else {
        npmInstall(repos, index, 0, cloneNext);
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
  function npmInstall(index, indexTruffleTree, cloneNext) {
    if (index < repos.length) {
      if (indexTruffleTree < repos[index].truffleTrees.length) {
        const cwd = path.resolve(
          targetCloneDir,
          path.join(
            repos[index].repo.full_name,
            path.join(repos[index].truffleTrees[indexTruffleTree].path),
          ),
          '..',
        );
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
            if (code === 0 && signal == null) {
              console.log(
                colors.green(
                  `Concluído npm install ${repos[index].repo.full_name}`,
                ),
              );
            } else {
              console.warn(
                colors.yellow(
                  `Erro onExit npm install ${
                    repos[index].repo.full_name
                  }. Verifique o console para identificar a causa`,
                ),
              );
            }
            if (cloneNext) {
              npmInstall(repos, index, indexTruffleTree + 1, true);
            }
          });
        } else {
          if (cloneNext) {
            npmInstall(repos, index, indexTruffleTree + 1, true);
          }
        }
      } else {
        cloneAndInstall(repos, index + 1, true);
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
