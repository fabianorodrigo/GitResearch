'use strict';
const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const path = require('path');
const Moment = require('moment');
const colors = require("colors");
const axios = require("axios");

const baseURL = `http://arquitetura.ancinerj.gov.br/deploy-producao/ancine`;


class DeployService {

    constructor() {
    }


    /***
     * @param url URL da tag instalada
     */
    async getDeployFromTagInstalada(url) {
        try {
            const response = await axios.get(`${baseURL}?query={"tagInstalada":"${url}"}`);
            //console.log(`${baseURL}?query={"tagInstalada":"${url}"}`)
            return response.data;
        } catch (e) {
            console.error('getDeployFromTagInstalada -', colors.red(e));
            global.log.error(e);
        }
    }
}


module.exports = DeployService;
