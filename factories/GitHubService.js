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
const verbose = true;

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: {
        username: process.env.GITHUB_USERNAME,
        password: process.env.GITHUB_PASSWORD,
      },
    });

    this._lastReposCommits = {};

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
   * Search public repositories by language
   * @param {String} language  Programming language to filter
   * @param {String} sort Field to which the results will be ordered: See https://developer.github.com/v3/search/#search-repositories
   * @param {String} order Order ASC or DESC that the results will be presented
   * @param {Number} per_page Results per page (max 100)
   * @param {Number} page Page number to retrieve in the results
   * @param {string} additionalFilter If informed, append to the query string
   * @returns Object with response of the server. If success, this object contains a property
   * "items", an array with all repositories found
   */
  async getReposByLanguage({
    language,
    sort,
    order,
    per_page = 100,
    page = 1,
    additionalFilter,
  }) {
    if (verbose) {
      console.log(
        new Date(),
        'getReposByLanguage',
        language,
        sort,
        order,
        per_page,
        page,
      );
    }
    const result = await this.octokit.search.repos({
      q: `language:${language}+is:public${
        additionalFilter == null ? '' : `+${additionalFilter}`
      }`,
      sort,
      order,
      per_page,
      page,
    });
    if (result.status === 200) {
      return result.data;
    }
    throw new Error(
      `Fail to search for language '${language}' repositories: ${
        result.status
      }`,
    );

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
   * Search in the github for the last commit of a repo and cache it
   * @param {String} owner Owner being analysed
   * @param {String} repo  Repo being analysed
   * @returns The last commit cached or retrieved
   */
  async getLastRepoCommit({ owner, repo }) {
    if (this._lastReposCommits[`${owner}/${repo}`] == null) {
      if (verbose) {
        console.log(new Date(), 'getLastRepoCommit', owner, repo);
      }
      const resultCommits = await this.octokit.repos.listCommits({
        owner,
        repo,
      });
      if (resultCommits.status === 200) {
        this._lastReposCommits[`${owner}/${repo}`] = resultCommits.data[0];
      } else {
        console.log(
          colors.red(resultCommits.status),
          ':',
          resultCommits.headers,
        );
        throw new Error(
          `Fail to list commits in repository ${repo} of owner ${owner}: ${
            resultCommits.status
          }`,
        );
      }
    }
    return this._lastReposCommits[`${owner}/${repo}`];
  }
  /**
   * Search in the the repository for the diretories that has the same name as {@directoryName}
   *
   * @param {String} owner Owner being analysed
   * @param {String} repo  Repo being analysed
   * @param {Array} names List of names of directories/files that you're searching for
   * @param {string} treeType The type of tree you're searching for (default = tree)
   * @returns Results of search
   */
  async searchTreesInRepository({ owner, repo, names, treeType = 'tree' }) {
    const results = [];
    try {
      const lastCommit = await this.getLastRepoCommit({ owner, repo });
      if (verbose) {
        console.log(
          new Date(),
          'searchTreesInRepository',
          owner,
          repo,
          names,
          treeType,
        );
      }
      const resultTree = await this.octokit.git.getTree({
        owner,
        repo,
        tree_sha: lastCommit.sha,
        recursive: 1,
      });
      if (resultTree.status === 200) {
        if (resultTree.data.truncated) {
          throw new Error('Truncated situation need to be handled');
        } else {
          for (const tree of Object.values(resultTree.data.tree)) {
            // Only directories that last part of path corresponds to the directoryName
            if (tree.type === treeType) {
              for (const treeName of names) {
                if (
                  (tree.path === treeName ||
                    tree.path.endsWith('/'.concat(treeName))) &&
                  tree.path.indexOf('node_modules') === -1
                ) {
                  results.push(tree);
                  break;
                } else if (
                  (tree.path === treeName ||
                    tree.path.endsWith('/'.concat(treeName))) &&
                  tree.path.indexOf('node_modules') !== -1
                ) {
                  console.log(
                    '==============> Dispensado por ter node_modules',
                    colors.red(tree.path),
                  );
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
    } catch (e) {
      console.log(colors.red('EXCEPTION:'), e.message);
      return e;
    }
  }

  /**
   * Get a tree in the the repository
   *
   * @param {String} owner Owner being analysed
   * @param {String} repo  Repo being analysed
   * @param {string} tree_sha The sha of a the tree you want
   * @param {boolean} recursive TRUE if you want a recursive search
   * @returns Results of search
   */
  async getATree({ owner, repo, tree_sha, recursive = false }) {
    const results = [];

    if (verbose) {
      console.log(new Date(), 'getATree', owner, repo, tree_sha, recursive);
    }

    try {
      const resultTree = await this.octokit.git.getTree({
        owner,
        repo,
        tree_sha,
        recursive: 1,
      });
      if (resultTree.status === 200) {
        if (resultTree.data.truncated) {
          throw new Error('Truncated situation need to be handled');
        } else {
          for (const tree of Object.values(resultTree.data.tree)) {
            results.push(tree);
          }
          return results;
        }
      } else {
        console.log(colors.red(resultTree.status), ':', resultTree.headers);
        throw new Error(
          `Fail to search for tree in repository ${repo} of owner ${owner} sha ${
            resultTree.data[0].sha
          }: ${resultTree.status}`,
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
    if (verbose) {
      console.log(new Date(), 'getFilesInRepo', repo, name);
    }
    try {
      const result = await this.octokit.search.code({
        q: `+filename:${name}+repo${repo}`,
      });

      if (result.status === 200) {
        return result.data;
      }
      console.log(colors.red(result.status), ':', result.headers);
      throw new Error(
        `Fail to search for file/directory '${name}' in repository ${repo}: ${
          result.status
        }`,
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
    if (verbose) {
      console.log(new Date(), 'getExpressionInContent', repo, expression);
    }
    const result = await this.octokit.search.code({
      q: `${expression}+in:file+repo${repo}`,
    });
    if (result.status === 200) {
      return result.data;
    }
    console.log(colors.red(result.status), ':', result.headers);
    throw new Error(
      `Fail to search for expression '${expression}' in repository ${repo}: ${
        result.status
      }`,
    );
  }
}

module.exports = GitHubService;
