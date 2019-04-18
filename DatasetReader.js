'use strict';

/*****************************************************************************************************
 Módulo responsável pela manutenção das configurações
******************************************************************************************************/

//Faz requires fora do módulo para que não seja importada novamente toda 
//as vezes que a função exportada for utilizada
//Isto por que o modulo, uma vez importado, fica em cache
let fs = require('fs');
let path = require("path");
let fsextra = require('fs-extra');

class DatasetReader {

    loadDatasetList_dados_gov_br() {
        const filePath = "./datasetList-dados_gov_br.json";
        let jsonContent = JSON.parse(fs.readFileSync(filePath, 'UTF-8'));
		return jsonContent;
	}

    loadDatasetList_dados_al_gov_br() {
        const filePath = "./datasetList-dados_al_gov_br.json";
        let jsonContent = JSON.parse(fs.readFileSync(filePath, 'UTF-8'));
		return jsonContent;
    }
    
    loadDatasetList_dados_recife_pe_gov_br() {
        const filePath = "./datasetList-dados_recife_pe_gov_br.json";
        let jsonContent = JSON.parse(fs.readFileSync(filePath, 'UTF-8'));
		return jsonContent;
	}

}

module.exports = DatasetReader;