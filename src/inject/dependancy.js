const express = require('express');
const path = require('path');

const dependancyInjector = function DependancyInjector(app){
    app.use('/bootstrap/css', express.static(path.join(__dirname, '../../node_modules/bootstrap/dist/css')))
    app.use('/bootstrap/js', express.static(path.join(__dirname, '../../node_modules/bootstrap/dist/js')))
    app.use('/assets', express.static(path.join(__dirname, '../assets')))
    app.use('/css', express.static(path.join(__dirname, '../css')))
    app.use('/js', express.static(path.join(__dirname, '../js')))
    app.use('/ace', express.static(path.join(__dirname, '../../node_modules/ace-builds/src-noconflict')))
}

module.exports = dependancyInjector;