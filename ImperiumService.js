'use strict';
const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const path = require('path');
const Moment = require('moment');
const colors = require("colors");
const axios = require("axios");

const baseURL = `http://imperium.ancine.gov.br/api/`;


class ImperiumService {

    constructor() {
    }

    async getSprintsPublicadasAposData(data) {
        const sprints = []
        try {
            const response = await axios.get(`${baseURL}projetos`);
            const projetos = response.data;
            projetos.forEach(p => {
                p.sprints.forEach(sp => {
                    if (sp.dataProducao != null && Moment(sp.dataProducao).isAfter(data)) {
                        sp.numeroProjeto = p.numeroProjeto;
                        sprints.push(sp);
                    }
                });
            });
            return sprints;
        } catch (e) {
            console.error('getSprintsPublicadasAposData -', colors.red(e));
            global.log.error(e);
        }
    }

    async getSprint(imp, nomeSprint) {
        try {
            //console.log(`${baseURL}projetos?filter={"where":{"numeroProjeto":${imp}}}`.yellow)
            const response = await axios.get(`${baseURL}projetos?filter={"where":{"numeroProjeto":${imp}}}`);
            const projeto = response.data;
            if (projeto.length == 0 || projeto[0].sprints == null) {
                console.warn(`Projeto sem sprints: ${imp}`.red);
                return null;
            } else {
                const sprint = projeto[0].sprints.filter(sp => {
                    return sp.nomeSprint == nomeSprint;
                });
                //console.log(colors.green(sprint));
                return sprint;
            }
        } catch (e) {
            console.error('getSprint -', colors.red(e));
            global.log.error(e);
        }
    }
}


module.exports = ImperiumService;
