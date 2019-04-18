'use strict';
const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const path = require('path');
const Moment = require('moment');
const colors = require("colors");
const axios = require("axios");

const baseURL = `http://data.wu.ac.at/portalwatch/api/v1/`;

class ComputeService {

    constructor(snapshot, portalId) {

        if (snapshot == null || portalId == null) {
            throw new Error('Constructor parameters not satisfied');
        }

        this._portalId = portalId;
        this._snapshot = snapshot;

        this._existenceDate = 0; //exda NUMBER - Average
        this._existenceDiscovery = 0; //exdi NUMBER
        this._existenceContact = 0; //exco BOOLEAN
        this._conformanceLicense = 0; //coli BOOLEAN
        this._conformanceDateFormat = 0;//coda NUMBER
        this._conformanceAccess = 0; //coac BOOLEAN
        this._opendataOpenFormat = 0;//opfo NUMBER
        this._opendataMachineRead = 0; //opma NUMBER
    }

    //Compute the metrics of the portal based on it's datasets
    //If filteted = true, compute just the datasets in the directory "filter"
    compute(filtered = false) {
        let countDownFiles = 0;
        let datasetCount = 0;
        let sumExistenceDate = 0; //exda - Average
        let sumExistenceDiscovery = 0; //exdi Average
        let sumExistenceContact = 0; //exco BOOLEAN MAX
        let sumConformanceLicense = 0; //coli BOOLEAN
        let sumConformanceDateFormat = 0;//coda NUMBER
        let sumConformanceAccess = 0; //coac BOOLEAN
        let sumOpendataOpenFormat = 0;//opfo NUMBER
        let sumOpendataMachineRead = 0; //opma NUMBER


        const dirPath = `./dados/${this._snapshot}/${this._portalId}/${filtered ? 'filter' : ''}`;
        fs.readdir(dirPath, function (e, files) {
            if (e) {
                console.error(colors.red(e));
                global.log.error(e);
            } else {
                countDownFiles = files.length;
                files.forEach(function (f) {
                    if (fs.statSync(path.join(dirPath, f)).isFile()) {
                        const regEx = /^datasets-[A-z]+-(.*?).json$/;
                        const match = regEx.exec(f);
                        if (match != null) {
                            datasetCount++;
                            fs.readFile(path.join(`./dados/${this._snapshot}/${this._portalId}/metrics/`, `${match[1]}.json`), 'UTF-8', function (e, data) {
                                if (e) {
                                    console.error(`Leitura de ${path.join(dirPath, f)}`, colors.red(e));
                                    global.log.error(e);
                                    throw e;
                                }
                                let metrics = JSON.parse(data);
                                sumExistenceDate += metrics.exda;
                                sumExistenceDiscovery += metrics.exdi;
                                sumExistenceContact += metrics.exco ? 1 : 0;
                                sumConformanceLicense += metrics.coli ? 1 : 0;
                                sumConformanceDateFormat += metrics.coda;
                                sumConformanceAccess += metrics.coac ? 1 : 0;
                                sumOpendataOpenFormat += metrics.opfo;
                                sumOpendataMachineRead += metrics.opma;

                                countDownFiles--;
                                if (countDownFiles == 0) {
                                    this._existenceDate = sumExistenceDate / datasetCount;
                                    this._existenceDiscovery = sumExistenceDiscovery / datasetCount;
                                    this._existenceContact = sumExistenceContact / datasetCount;
                                    this._conformanceLicense = sumConformanceLicense / datasetCount;
                                    this._conformanceDateFormat = sumConformanceDateFormat / datasetCount;
                                    this._conformanceAccess = sumConformanceAccess / datasetCount;
                                    this._opendataOpenFormat = sumOpendataOpenFormat / datasetCount;
                                    this._opendataMachineRead = sumOpendataMachineRead / datasetCount;
                                    console.log(colors.yellow(this._portalId), `${filtered ? '(filtrado)'.yellow : ''}:`, datasetCount);
                                    console.log('Existence Date: ', this._existenceDate);
                                    console.log('Existence Discovery: ', this._existenceDiscovery);
                                    console.log('Existence Contact: ', this._existenceContact);
                                    console.log('Conformance License: ', this._conformanceLicense);
                                    console.log('Conformance Date Format: ', this._conformanceDateFormat);
                                    console.log('Conformance Access: ', this._conformanceAccess);
                                    console.log('Opendata Open Format: ', this._opendataOpenFormat);
                                    console.log('Opendata Machine Read: ', this._opendataMachineRead);
                                }
                            }.bind(this));
                        }
                    } else {
                        countDownFiles--;
                    }
                }.bind(this))

            }
        }.bind(this))
    }

}


module.exports = ComputeService;
