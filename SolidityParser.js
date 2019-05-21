const fs = require('fs');
const antlrParser = require('solidity-parser-antlr');

const SolidityParser = {
  _astCache: {},

  _contractsCache: {},

  /**
   * Read the SOLIDITY file and returns it's AST
   *
   * @param {string} solFilePath Path of the solidity file
   * @param {boolean} force If FALSE (default) and exists in the {_astCache} return it, otherwise, read the file, parse it and store in the cache
   */
  parse(solFilePath, force = false) {
    if (force || SolidityParser._astCache[solFilePath] == null) {
      const solContent = fs.readFileSync(solFilePath, 'UTF8');
      try {
        const ast = antlrParser.parse(solContent, { loc: true });
        SolidityParser._astCache[solFilePath] = ast;
      } catch (e) {
        if (e instanceof antlrParser.ParserError) {
          console.error('ParserError', e.errors);
        } else {
          console.error('Error', e.errors);
        }
      }
    } else {
      // console.log(solFilePath, 'AST retrieved from cache')
    }
    return SolidityParser._astCache[solFilePath];
  },

  /**
   * Extract ContractDefinition from the Abstract Syntax Tree retrieved from the solidity file
   *
   * @param {string} solFilePath Path of the solidity file
   * @param {boolean} force If FALSE (default) and exists in the {_contractsCache} return it, otherwise, read the file, parse it and store in the cache
   */
  getContracts(solFilePath, force = false) {
    const ast = SolidityParser.parse(solFilePath);
    if (force || SolidityParser._contractsCache[solFilePath] == null) {
      const contracts = [];
      // output the kind of each ContractDefinition found
      antlrParser.visit(ast, {
        ContractDefinition(node) {
          contracts.push(node);
        },
      });
      SolidityParser._contractsCache[solFilePath] = contracts;
      return contracts;
    }
    // console.log(solFilePath, 'contracts retrieved from cache')
    return SolidityParser._contractsCache[solFilePath];
  },

  /**
   * Extract PragmaDirective with the Solidity version from the Abstract Syntax Tree retrieved from the solidity file
   *
   * @param {string} solFilePath Path of the solidity file
   */
  getSolidityVersions(solFilePath) {
    const ast = SolidityParser.parse(solFilePath);
    const pragmaDirectives = [];
    // output the kind of each ContractDefinition found
    antlrParser.visit(ast, {
      PragmaDirective(node) {
        pragmaDirectives.push(node);
      },
    });
    return pragmaDirectives;
  },

  /**
   * Read each node of the Abstract Syntax Tree
   * @param {object} ast Abstract Syntax Tree to be read
   */
  visit(ast) {
    // output the kind of each ContractDefinition found
    antlrParser.visit(ast, {
      FunctionDefinition(node) {
        console.log(node.visibility, node.name);
        console.log('Parameters:', node.parameters.parameters);
        console.log(
          'Return:',
          node.returnParameters == null
            ? 'Void'
            : node.returnParameters.parameters,
        );
        console.log('Body:', node.body.statements);
        console.log('node', node);
      },
    });
  },

  /** *
   * Receive a contract and return its constructor function
   *
   * @param {object} contract Contract extracted from a AST
   */
  getContractConstructor(contract) {
    for (let i = 0; i < contract.subNodes.length; i++) {
      if (
        contract.subNodes[i].type === 'FunctionDefinition' &&
        contract.subNodes[i].isConstructor
      ) {
        return contract.subNodes[i];
      }
    }
    return null;
  },

  /** *
   * Receive a contract and return a array with all your functions BUT contructor and private ones
   *
   * @param {string} solidityPath Path of the solidity file and where the FunctionDefinitions will be extracted from
   * @returns {Array} [{contractName string, functionDefinition object}]
   */
  extractFunctionsFromContractDefinition(solidityPath) {
    const contractDefinitionCollection = SolidityParser.getContracts(
      solidityPath,
    );
    const functionsReturn = [];
    contractDefinitionCollection.forEach(contractDefinition => {
      const constructor = SolidityParser.getContractConstructor(
        contractDefinition,
      );
      contractDefinition.subNodes.forEach(sn => {
        // Include all functions (except constructor and privates)
        if (
          sn.type === 'FunctionDefinition' &&
          !sn.isConstructor &&
          sn.visibility != 'private'
        ) {
          functionsReturn.push({
            contractPath: solidityPath,
            contractName: contractDefinition.name,
            functionDefinition: sn,
            constructorDefinition: constructor,
          });
        }
      });
    });
    return functionsReturn;
  },

  /**
   * Literal addresses are interpreted as NumberLiteral
   * So if it has this carachteriscs, we infer it is a Address
   *
   * @param {string} value The value to evaluate
   */
  isAddress: value => value.length === 42 && value.startsWith('0x'),
};

module.exports = SolidityParser;
