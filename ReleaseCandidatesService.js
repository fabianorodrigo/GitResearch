'use strict';
const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const path = require('path');
const Moment = require('moment');
const colors = require("colors");
const axios = require("axios");

const baseURL = `http://arquitetura.ancinerj.gov.br/ancineci/rcs`;


class ReleasesCandidatesService {

    constructor() {
    }


    async getRCsDemanda(tipo, identificacao, subIdentificacao) {
        try {
            //console.log(colors.red(`${baseURL}?query={"demanda.tipo":"${tipo}", "demanda.identificacao":"${identificacao}", "demanda.subIdentificacao":"${subIdentificacao}"}`))
            const response = await axios.get(`${baseURL}?query={"demanda.tipo":"${tipo}", "demanda.identificacao":"${identificacao}", "demanda.subIdentificacao":"${subIdentificacao}"}`);
            return response.data;
        } catch (e) {
            console.error('getRCsDemanda -', colors.red(e));
            global.log.error(e);
        }
    }
}


module.exports = ReleasesCandidatesService;
