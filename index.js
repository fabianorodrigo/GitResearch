var EventEmitter = require("events").EventEmitter;

const readlineSync = require("readline-sync");

const ReleaseFinaisService = require("./ReleaseFinaisService");
const ReleaseCandidatesService = require("./ReleaseCandidatesService");
const DeployService = require('./DeployService');
const ImperiumService = require("./ImperiumService");
let Moment = require('moment');
const colors = require("colors");
const bunyan = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');

let logOptions = {
    name: '/queriesAvulsas',
    streams: [{
        stream: new RotatingFileStream({
            level: 'debug',
            path: 'logs/log%Y%m%d.json',
            period: '1d',          // daily rotation 
            totalFiles: 10,        // keep up to 10 back copies 
            rotateExisting: true,  // Give ourselves a clean file when we start up, based on period 
            threshold: '10m',      // Rotate log files larger than 10 megabytes 
            totalSize: '20m',      // Don't keep more than 20mb of archived log files 
            gzip: true,             // Compress the archive log files to save space 
            src: true               // Include info about the source of the error
        })
    }]
};


global.log = bunyan.createLogger(logOptions);

function printCentro(valor) {
    console.log(valor.padStart(Math.floor((WIDTH / 2) + (valor.length / 2)), " ").yellow);
}


process.on('uncaughtException', (err) => {
    global.log.error(err);
    console.error(`Caught exception: ${err}\n`);
    console.error(err.stack)
});


const WIDTH = 150;
global.trace = true;


const lineGraph = "#".padStart(WIDTH, "#");
console.log(lineGraph.yellow);
printCentro("Starting querying ");
console.log(lineGraph.yellow);

(async () => {
    console.log("TIPO", ";", "IMP", ";", "SPRINT", ";", "QT RCS",";", "RF", ";", "CRIAÇÃO RF", ";", "DEPLOY", ";", "OS", ";", "PRODUTOS");

    const rfService = new ReleaseFinaisService();
    const rcsService = new ReleaseCandidatesService();
    const deployService = new DeployService();
    const imperiumService = new ImperiumService();
   /* const rfsAfter = await rfService.getRFsCriadasAposData(new Moment("2016-12-31"));
    
    rfsAfter.forEach(async rf => {
        let sprints = []
        if (rf.demanda.tipo == 'PROJETO') {
            sprints = await imperiumService.getSprint(parseInt(rf.demanda.identificacao), rf.demanda.subIdentificacao);
            if (sprints && sprints.length > 1) {
                console.warn(colors.red(`Retornou ${sprints.length} sprints`))
            }
        }
        const deploys = await deployService.getDeployFromTagInstalada(rf.rfScmUrl);
        const dataDeploy = deploys == null || deploys.length == 0 ? '???' : deploys[0].data;
        console.log(rf.demanda.tipo, ";", rf.demanda.identificacao, ";", rf.demanda.subIdentificacao, ";", rf.nomeRf, ";", rf.dataCriacao, ";", dataDeploy, ";", sprints && sprints.length > 0 ? sprints[0].numeroOS : 'NULL', ";", sprints && sprints.length > 0 && sprints[0].produtos ? sprints[0].produtos.join(',') : '[]');
    });*/

    const numProjetoCIFormat = "0000000";

    const sprints = await imperiumService.getSprintsPublicadasAposData(new Moment("2016-12-31"));
    sprints.forEach(async sp => {
        const identificacao = (numProjetoCIFormat + sp.numeroProjeto.toString()).substr(sp.numeroProjeto.toString().length);
        //console.log(colors.yellow(identificacao),numProjetoCIFormat.length-sp.numeroProjeto.toString().length)
        const rfs = await rfService.getRFsDemanda('PROJETO', identificacao, sp.nomeSprint);
        const rcs = await rcsService.getRCsDemanda('PROJETO', identificacao, sp.nomeSprint);
        //console.log(rfs)
        if (rfs != null && rfs.length > 0) {
            rfs.forEach(async rf => {
                const deploys = await deployService.getDeployFromTagInstalada(rf.rfScmUrl);
                const dataDeploy = deploys == null || deploys.length == 0 ? '???' : deploys[0].data;
                console.log("PROJETO;", sp.numeroProjeto, ";", sp.nomeSprint, ";", rcs.length,";", rf.nomeRf, ";", rf.dataCriacao, ";", dataDeploy, ";", sp.numeroOS, ";", sp.produtos ? sp.produtos.join(',') : '[]');
            })
        } else {
            console.log("PROJETO;", sp.numeroProjeto, ";", sp.nomeSprint, ";", rcs.length, ";-;-;", sp.dataProducao, "*;", sp.numeroOS, ";", sp.produtos ? sp.produtos.join(',') : '[]');
        }
    })

})();

//const snapshot = readlineSync.question("What is the requested snapshot (YYWW)?");


//ee.emit("findFolderEvent");
const intervalApp = setInterval(() => { }, 10000);

