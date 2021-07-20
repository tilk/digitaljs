"use strict";

import _ from 'lodash';

export function removeRepeater(model, dev, id) {
    if (dev.type != 'Repeater') return false;
    const outConns = model.outputPortConnectors(id, "out");
    const inConns = model.inputPortConnectors(id, "in");
    model.removeDevice(id);
    for (const inConn of Object.values(inConns)) {
        if (inConn.from.id == id) continue;
        for (const outConn of Object.values(outConns)) {
            if (outConn.to.id == id) continue;
            const conn = {from: inConn.from, to: outConn.to};
            if ('name' in inConn) conn.name = inConn.name;
            if ('name' in outConn) conn.name = outConn.name;
            model.addConnector(conn);
        }
    }
    return true;
}

const gate_negations = new Map([
    ['And', 'Nand'],
    ['Nand', 'And'],
    ['Nor', 'Or'],
    ['Or', 'Nor'],
    ['Xor', 'Xnor'],
    ['Xnor', 'Xor'],
    ['AndReduce', 'NandReduce'],
    ['NandReduce', 'AndReduce'],
    ['NorReduce', 'OrReduce'],
    ['OrReduce', 'NorReduce'],
    ['XorReduce', 'XnorReduce'],
    ['XnorReduce', 'XorReduce']]);

export function integrateNegation(model, dev, id) {
    if (!gate_negations.has(dev.type)) return false;
    const outConns = model.outputPortConnectors(id, "out");
    const outConnList = Object.values(outConns);
    if (outConnList.length != 1) return false;
    if (outConnList[0].to.id == id) return false;
    const negDev = model.getDevice(outConnList[0].to.id);
    if (negDev.type != 'Not') return false;
    dev.type = gate_negations.get(dev.type);
    const negOutConns = model.outputPortConnectors(outConnList[0].to.id, "out");
    model.removeDevice(outConnList[0].to.id);
    for (const negOutConn of Object.values(negOutConns)) {
        const conn = {from: outConnList[0].from, to: negOutConn.to};
        if ('name' in negOutConn) conn.name = negOutConn.name;
        model.addConnector(conn);
    }
    return true;
}

export const transformations = [removeRepeater, integrateNegation];

export class CircuitModel {
    constructor(data) {
        this._devices = {};
        this._connectors = {};
        this._forward = {};
        this._backward = {};
        this._connCount = 0;

        for (const [id, dev] of Object.entries(data.devices)) {
            this.addDevice(dev, id);
        }
        for (const conn of Object.values(data.connectors)) {
            this.addConnector(conn);
        }
    }
    _freshConnectorId() {
        this._connCount += 1;
        return this._connCount;
    }
    addDevice(dev, id) {
        console.assert(!(id in this._devices));
        this._devices[id] = _.cloneDeep(dev);
        this._forward[id] = {};
        this._backward[id] = {};
    }
    getDevice(id) {
        return this._devices[id];
    }
    removeDevice(id) {
        console.assert(id in this._devices);
        delete this._devices[id];
        const conns = {};
        for (const data of Object.values(this._forward[id]))
            for (const connId of Object.keys(data))
                conns[connId] = true;
        for (const data of Object.values(this._backward[id]))
            for (const connId of Object.keys(data))
                conns[connId] = true;
        for (const connId of Object.keys(conns))
            this.removeConnector(connId);
    }
    addConnector(conn) {
        console.assert(conn.from.id in this._devices);
        console.assert(conn.to.id in this._devices);
        const id = this._freshConnectorId();
        this._connectors[id] = _.cloneDeep(conn);
        function addAdjacent(adjacent, endpoint) {
            if (!(endpoint.port in adjacent[endpoint.id]))
                adjacent[endpoint.id][endpoint.port] = {};
            adjacent[endpoint.id][endpoint.port][id] = true;
        }
        addAdjacent(this._forward, conn.from);
        addAdjacent(this._backward, conn.to);
        return id;
    }
    removeConnector(id) {
        const conn = this._connectors[id];
        delete this._forward[conn.from.id][conn.from.port][id];
        delete this._backward[conn.to.id][conn.to.port][id];
        delete this._connectors[id];
    }
    outputPortConnectors(id, port) {
        const ret = {};
        if (port in this._forward[id])
            for (const connId of Object.keys(this._forward[id][port]))
                ret[connId] = this._connectors[connId];
        return ret;
    }
    inputPortConnectors(id, port) {
        const ret = {};
        if (port in this._backward[id])
            for (const connId of Object.keys(this._backward[id][port]))
                ret[connId] = this._connectors[connId];
        return ret;
    }
    outputConnectors(id) {
        const ret = {};
        for (const data of Object.values(this._forward[id]))
            for (const connId of Object.keys(data))
                ret[connId] = this._connectors[connId];
        return ret;
    }
    inputConnectors(id) {
        const ret = {};
        for (const data of Object.values(this._backward[id]))
            for (const connId of Object.keys(data))
                ret[connId] = this._connectors[connId];
        return ret;
    }
    toJSON() {
        return {
            devices: this._devices,
            connectors: Object.values(this._connectors)
        }
    }
    transform(f) {
        let iter = true;
        let ret = false;
        while (iter) {
            iter = false;
            for (const [id, dev] of Object.entries(this._devices)) {
                if (id in this._devices)
                    iter = iter || f(this, dev, id);
            }
            ret = ret || iter;
        }
        return ret;
    }
    transformMany(fs) {
        let ret = false;
        for (const f of fs)
            ret = ret || this.transform(f);
        return ret;
    }
};

export function transformCircuit(circuit, fs)
{
    fs = fs || transformations;
    function help(circ) {
        const model = new CircuitModel(circ);
        model.transformMany(fs);
        return model.toJSON();
    }
    const ret = help(circuit);
    if ('subcircuits' in circuit) {
        ret.subcircuits = {};
        for (const [id, subcirc] of Object.entries(circuit.subcircuits)) {
            ret.subcircuits[id] = help(subcirc);
        }
    }
    return ret;
}


