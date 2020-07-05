const colors = require('colors');
const readlineSync = require('readline-sync');

module.exports = async function queries(resultsQuery) {
  let functionality = null;

  while (functionality !== '0') {
    functionality = readlineSync.question(`What do you want to query?

  1. Show Compile Results
  2. Show Compile Fail Projects
  3. Show Compile Success Results
  4. Show Compile Results (only 0.5.*)
  5. Show Error Results

  20. Show Migrate Results
  21. Show Migrage Fail Results
  22. Show Migrage Success Results
  23. Show Migrate Results (only 0.5.*)
  24. Show Error Results

  50. Show Test Results (Full)
  51. Show Test Fail Results
  52. Show Test Success Results
  53. Show Test NOT Executed
  54. Show Test Executed
  55. Show Error Results

  90. Export test results to CSV

  0. Return

  Your choice: `);

    if (['90'].indexOf(functionality) > -1) {
      resultsQuery.showResults('test', false, null, null, null, true);
    } else if (['55'].indexOf(functionality) > -1) {
      resultsQuery.showErrorResults('test', null);
    } else if (['50', '51', '52', '53', '54'].indexOf(functionality) > -1) {
      let successFilter =
        ['50', '53', '54'].indexOf(functionality) > -1
          ? null
          : functionality === '52';
      let postFilter =
        ['53', '54'].indexOf(functionality) === -1
          ? null
          : { property: 'test', value: functionality === '54' };
      const result = resultsQuery.showResults(
        'test',
        true,
        successFilter,
        null,
        postFilter,
      );
      let choice = '';
      do {
        choice = readlineSync.question(`Show details: `);
        if (Number.isInteger(parseInt(choice))) {
          console.log(result[choice]);
          console.log(choice, colors.yellow(result[choice].full_name));
          console.log('-'.padStart(150, '-').yellow);
        }
      } while (result[choice] != null);
    } else if (['24'].indexOf(functionality) > -1) {
      resultsQuery.showErrorResults('migrate', null);
    } else if (['20', '21', '22', '23'].indexOf(functionality) > -1) {
      let successFilter =
        functionality === '20' || functionality === '23'
          ? null
          : functionality === '22';
      let result = resultsQuery.showResults(
        'migrate',
        true,
        successFilter,
        functionality == '23' ? '0.5.' : null,
      );
      let choice = '';
      do {
        choice = readlineSync.question(`Show details: `);
        console.log(result[choice]);
        console.log('-'.padStart(150, '-').yellow);
      } while (result[choice] != null);
    } else if (['5'].indexOf(functionality) > -1) {
      resultsQuery.showErrorResults('compile', null);
    } else if (['1', '2', '3', '4'].indexOf(functionality) > -1) {
      let successFilter =
        functionality === '1' || functionality === '4'
          ? null
          : functionality === '3';
      let result = resultsQuery.showResults(
        'compile',
        readlineSync
          .question(
            'List only projects that contains a "test" directory (s/N)? ',
          )
          .toUpperCase() == 'S',
        successFilter,
        functionality == '4' ? '0.5.' : null,
      );
      let choice = '';
      do {
        choice = readlineSync.question(`Show details: `);
        console.log(result[choice]);
        console.log('-'.padStart(150, '-').yellow);
      } while (result[choice] != null);
    }
  }
};
