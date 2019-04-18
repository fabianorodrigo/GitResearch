'use strict';
const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const path = require('path');
const Moment = require('moment');
const colors = require("colors");
const axios = require("axios");

const baseURL = `http://arquitetura.ancinerj.gov.br/ancineci/rfs`;


class ReleasesFinaisService {

    constructor() {
    }


    /***
     * @param data Tipo
     */
    async getRFsCriadasAposData(data) {
        try {
            const response = await axios.get(baseURL);
            const rfs = response.data;
            return rfs.filter(rf => {
                return Moment(rf.dataCriacao).isAfter(data);
            })
        } catch (e) {
            console.error('getRFsCriadasAposData -', colors.red(e));
            global.log.error(e);
        }
    }

    async getRFsDemanda(tipo, identificacao, subIdentificacao) {
        try {
            //console.log(colors.red(`${baseURL}?query={"demanda.tipo":"${tipo}", "demanda.identificacao":"${identificacao}", "demanda.subIdentificacao":"${subIdentificacao}"}`))
            const response = await axios.get(`${baseURL}?query={"demanda.tipo":"${tipo}", "demanda.identificacao":"${identificacao}", "demanda.subIdentificacao":"${subIdentificacao}"}`);
            return response.data;
        } catch (e) {
            console.error('getRFsCriadasAposData -', colors.red(e));
            global.log.error(e);
        }
    }
}


module.exports = ReleasesFinaisService;
