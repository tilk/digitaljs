"use strict";

import _ from 'lodash';
import { Vector3vl } from '3vl';

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

const arith_constant = new Map([
    ['Addition', 'AdditionConst'],
    ['Subtraction', 'SubtractionConst'],
    ['Multiplication', 'MultiplicationConst'],
    ['Division', 'DivisionConst'],
    ['Modulo', 'ModuloConst'],
    ['Power', 'PowerConst'],
    ['ShiftLeft', 'ShiftLeftConst'],
    ['ShiftRight', 'ShiftRightConst'],
    ['Lt', 'LtConst'],
    ['Le', 'LeConst'],
    ['Gt', 'GtConst'],
    ['Ge', 'GeConst'],
    ['Eq', 'EqConst'],
    ['Ne', 'NeConst']]);

export function integrateArithConstant(model, dev, id) {
    if (!arith_constant.has(dev.type)) return false;
    function help(inConnList, inConnList2, outConnList, sgn, in1, in2) {
        if (inConnList.length != 1) return false;
        const inId = inConnList[0].from.id;
        const inDev = model.getDevice(inId);
        if (inDev.type != 'Constant') return false;
        const val = Vector3vl.fromBin(inDev.constant, inDev.constant.length);
        if (!val.isFullyDefined) return false;
        const i = val.toBigInt(sgn);
        if (i > 99 || i < -9) return false;
        const newDev = _.cloneDeep(dev);
        if (newDev.bits) {
            newDev.bits.in = newDev.bits[in2] || 1;
            delete newDev.bits[in1];
            delete newDev.bits[in2];
        }
        if (newDev.signed) {
            newDev.signed.in = (newDev.signed[in1] && newDev.signed[in2]) || false;
            delete newDev.signed[in1];
            delete newDev.signed[in2];
        }
        newDev.leftOp = in1 == "in1";
        newDev.type = arith_constant.get(newDev.type);
        newDev.constant = i;
        model.removeDevice(id);
        const constOutConnList = Object.values(model.outputPortConnectors(inId, "out"));
        if (constOutConnList.length == 0)
            model.removeDevice(inId);
        model.addDevice(newDev, id);
        for (const conn of outConnList)
            model.addConnector(conn);
        for (const conn of inConnList2) {
            const newConn = _.cloneDeep(conn);
            newConn.to.port = "in";
            model.addConnector(newConn);
        }
        return true;
    }
    const outConnList = Object.values(model.outputPortConnectors(id, "out"));
    const in1ConnList = Object.values(model.inputPortConnectors(id, "in1"));
    const in2ConnList = Object.values(model.inputPortConnectors(id, "in2"));
    return help(in1ConnList, in2ConnList, outConnList, dev.signed.in1, "in1", "in2") 
        || help(in2ConnList, in1ConnList, outConnList, dev.signed.in2, "in2", "in1");
}

const gate_mergable = new Map([
    ["And", "And"],
    ["Or", "Or"],
    ["Xor", "Xor"],
    ["Nand", "And"],
    ["Nor", "Or"],
    ["Xnor", "Xor"]
]);

export function makeNAryGates(model, dev, id)
{
    function inputNumber(str) {
        return Number(str.match(/^in([0-9]+)$/)[1]);
    }
    if (!gate_mergable.has(dev.type)) return false;
    const inputs = dev.inputs || 2;
    const inConnList = Object.values(model.inputConnectors(id));
    const outConnList = Object.values(model.outputPortConnectors(id, "out"));
    for (const conn of inConnList) {
        const inId = conn.from.id;
        const inDev = model.getDevice(inId);
        if (inDev.type != gate_mergable.get(dev.type)) continue;
        const prevOutConnList = Object.values(model.outputConnectors(inId));
        if (prevOutConnList.length != 1) continue;
        if (prevOutConnList[0].to.id != id) continue;
        const mergeConnList = Object.values(model.inputConnectors(inId));
        const inputNo = inputNumber(conn.to.port);
        model.removeDevice(inId);
        model.removeDevice(id);
        const newDev = _.cloneDeep(dev);
        newDev.inputs = inputs + mergeConnList.length - 1;
        model.addDevice(newDev, id);
        for (const conn of outConnList)
            model.addConnector(conn);
        for (const conn of inConnList) {
            const connInputNo = inputNumber(conn.to.port);
            if (connInputNo == inputNo) continue;
            const newConn = _.cloneDeep(conn);
            if (connInputNo > inputNo)
                newConn.to.port = "in" + (connInputNo + mergeConnList.length - 1);
            model.addConnector(newConn);
        }
        for (const conn of mergeConnList) {
            const connInputNo = inputNumber(conn.to.port);
            const newConn = _.cloneDeep(conn);
            newConn.to.id = id;
            newConn.to.port = "in" + (connInputNo + inputNo - 1);
            model.addConnector(newConn);
        }
        return true;
    }
    return false;
}

export const transformations = [removeRepeater, integrateNegation, integrateArithConstant, makeNAryGates];

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
            ret = this.transform(f) || ret;
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
    console.log(ret);
    return ret;
}


