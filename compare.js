const fs = require('fs');
const path = require('path');
const colors = require('colors');

let researchData2606 = JSON.parse(
  fs.readFileSync('./data/20190626_GitResearchRepos/researchScopeData.json', {
    encoding: 'UTF8',
  }),
);

let researchData1507 = JSON.parse(
  fs.readFileSync('./data/20190715/researchScopeData.json', {
    encoding: 'UTF8',
  }),
);

console.log('PROJETOS SOMENTE EM 26/06'.yellow);
Object.keys(researchData2606).forEach(prj => {
  if (researchData1507[prj] == null) {
    console.log(
      'ls /home/fabianorodrigo/Projetos/ProjetosTerceiros/github/Solidity/20190715/'.concat(
        prj,
      ),
    );
  }
});

console.log('PROJETOS SOMENTE EM 15/07'.yellow);
Object.keys(researchData1507).forEach(prj => {
  if (researchData2606[prj] == null) {
    console.log(prj);
  }
});
