const colors = require('colors');
const Octokit = require('@octokit/rest');

/**
 * OCOKIT REFERENCE: https://octokit.github.io/rest.js/#octokit-routes-repos-list-public
 *
 * Search for repositories: https://api.github.com/search/repositories?q=+language:Solidity
 * Commits of a repo: https://api.github.com/repos/willitscale/learning-solidity/commits
 * Contents of a repo: https://api.github.com/repositories/103062798/contents/
 * Get a tree of a OWNER, REPO, SHA: https://api.github.com/repos/willitscale/learning-solidity/git/trees/36b11d0f1bc2b29112efeb9897cef2647fda8348?recursive=0
 *
 */

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: {
        username: process.env.GITHUB_USERNAME,
        password: process.env.GITHUB_PASSWORD,
      },
    });

    this.octokit.registerEndpoints({
      search: {
        tree: {
          method: 'GET',
          url: '/repos/:owner/:repo/git/trees/:tree_sha?recursive=1',
          headers: {
            accept: 'application/vnd.github.foo-bar-preview+json',
          },
          params: {
            owner: {
              required: true,
              type: 'string',
            },
            repo: {
              required: true,
              type: 'string',
            },
            tree_sha: {
              required: true,
              type: 'string',
            },
          },
        },
      },
    });
  }

  /**
   * Search repositories by language
   * @param {String} language  Programming language to filter
   * @param {String} sort Field to which the results will be ordered: See https://developer.github.com/v3/search/#search-repositories
   * @param {String} order Order ASC or DESC that the results will be presented
   * @param {Number} per_page Results per page (max 100)
   * @param {Number} page Page number to retrieve in the results
   * @returns Object with response of the server. If success, this object contains a property
   * "items", an array with all repositories found
   */
  async getReposByLanguage({
    language, sort, order, per_page = 100, page = 1,
  }) {
    const result = await this.octokit.search.repos({
      q: `language:${language}`,
      sort,
      order,
      per_page,
      page,
    });
    if (result.status === 200) {
      return result.data;
    }
    throw new Error(`Fail to search for language '${language}' repositories: ${result.status}`);

    /*  octokit.repos.listForOrg({
            org: 'octokit',
            type: 'public'
        }).then(({ data, status, headers }) => {
            console.log('data',data);
            console.log('status',status);
            console.log('headers',headers);
        }) */
  }

  /**
   * Search in the the repository for the diretories that has the same name as {@directoryName}
   *
   * @param {String} owner Owner being analysed
   * @param {String} repo  Repo being analysed
   * @param {Array} directoriesNames List of names of directories that you're searching for
   * @returns Results of search
   */
  async searchRepositoryWithDiretory({ owner, repo, directoriesNames }) {
    const results = [];
    try {
      const resultCommits = await this.octokit.repos.listCommits({
        owner,
        repo,
      });
      if (resultCommits.status === 200) {
        const resultTree = await this.octokit.git.getTree({
          owner,
          repo,
          tree_sha: resultCommits.data[0].sha,
        });
        if (resultTree.status === 200) {
          if (resultTree.data.truncated) {
            throw new Error('Truncated situation need to be handled');
          } else {
            for (const tree of Object.values(resultTree.data.tree)) {
              // Only directories that last part of path corresponds to the directoryName
              if (tree.type === 'tree') {
                for (const dirName of directoriesNames) {
                  if (tree.path === dirName || tree.path.endsWith('/'.concat(dirName))) {
                    results.push(tree);
                    break;
                  }
                }
              }
            }
            return results;
          }
        } else {
          console.log(colors.red(resultTree.status), ':', resultTree.headers);
          throw new Error(
            `Fail to search for tree in repository ${repo} of owner ${owner} sha ${
              resultCommits.data[0].sha
            }: ${resultTree.status}`,
          );
        }
      } else {
        console.log(colors.red(resultCommits.status), ':', resultCommits.headers);
        throw new Error(
          `Fail to list commits in repository ${repo} of owner ${owner}: ${resultCommits.status}`,
        );
      }
    } catch (e) {
      console.log(colors.red('EXCEPTION:'), e.message);
      return e;
    }
  }

  /**
   * Search in the the repository for the files and directories with the name
   * @param {String} repo  Repo being analysed
   * @param {String} name File or directory name that you're searching for
   * @returns Results of search
   */
  async getFilesInRepo({ repo, name }) {
    try {
      const result = await this.octokit.search.code({ q: `+filename:${name}+repo${repo}` });

      if (result.status === 200) {
        return result.data;
      }
      console.log(colors.red(result.status), ':', result.headers);
      throw new Error(
        `Fail to search for file/directory '${name}' in repository ${repo}: ${result.status}`,
      );
    } catch (e) {
      console.log(colors.red('EXCEPTION:'), e.message);
      return e;
    }
  }

  /**
   * Search in the code of the repository for the expression in it's content
   * @param {String} repo  Repo being analysed
   * @param {String} expression Expression that you're searching for
   * @returns Results of search
   */
  async getExpressionInContent({ repo, expression }) {
    const result = await this.octokit.search.code({ q: `${expression}+in:file+repo${repo}` });
    if (result.status === 200) {
      return result.data;
    }
    console.log(colors.red(result.status), ':', result.headers);
    throw new Error(
      `Fail to search for expression '${expression}' in repository ${repo}: ${result.status}`,
    );
  }
}

module.exports = GitHubService;
