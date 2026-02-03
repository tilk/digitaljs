"use strict";

import { util } from '@joint/core';
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
            model.addConnector(conn, [inConn, outConn]);
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
        model.addConnector(conn, [negOutConn, outConnList[0]]);
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
        if (i > 999 || i < -99) return false;
        const newDev = util.cloneDeep(dev);
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
        newDev.constant = Number(i);
        model.removeDevice(id);
        const constOutConnList = Object.values(model.outputPortConnectors(inId, "out"));
        if (constOutConnList.length == 0)
            model.removeDevice(inId);
        model.addDevice(newDev, id);
        for (const conn of outConnList)
            model.addConnector(conn);
        for (const conn of inConnList2) {
            const newConn = util.cloneDeep(conn);
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
        const newDev = util.cloneDeep(dev);
        newDev.inputs = inputs + mergeConnList.length - 1;
        model.addDevice(newDev, id);
        for (const conn of outConnList)
            model.addConnector(conn);
        for (const conn of inConnList) {
            const connInputNo = inputNumber(conn.to.port);
            if (connInputNo == inputNo) continue;
            const newConn = util.cloneDeep(conn);
            if (connInputNo > inputNo)
                newConn.to.port = "in" + (connInputNo + mergeConnList.length - 1);
            model.addConnector(newConn);
        }
        for (const conn of mergeConnList) {
            const connInputNo = inputNumber(conn.to.port);
            const newConn = util.cloneDeep(conn);
            newConn.to.id = id;
            newConn.to.port = "in" + (connInputNo + inputNo - 1);
            model.addConnector(newConn);
        }
        return true;
    }
    return false;
}

export function makeBinaryMuxes(model, dev, id)
{
    function inputNumber(str) {
        return Number(str.match(/^in([0-9]+)$/)[1]);
    }
    if (dev.type != "Mux1Hot") return false;
    const selConnList = Object.values(model.inputPortConnectors(id, "sel"));
    if (selConnList.length != 1) return false;
    const groupIds = [];
    const mapping = {};
    let srcsignal;
    let bits = -1;
    let sparse = false;
    function traverse(groupId, baseNo) {
        groupIds.push(groupId);
        const groupDev = model.getDevice(groupId);
        function handleConst(value, pBits, pInConnList) {
            if (value < 0) return false;
            if (value in mapping) return false;
            const constInConnList = pInConnList;
            if (constInConnList.length != 1) return false;
            if (srcsignal == undefined)
                srcsignal = constInConnList[0];
            if (srcsignal.from.id != constInConnList[0].from.id ||
                srcsignal.from.port != constInConnList[0].from.port) return false;
            const constBits = pBits || 1;
            if (bits == -1)
                bits = constBits;
            if (bits != constBits) return false;
            mapping[value] = baseNo;
            return true;
        }
        if (groupDev.type == "BusGroup") {
            let offset = 0;
            for (const [inputNo, groupSize] of (groupDev.groups || [1]).entries()) {
                const conns = Object.values(model.inputPortConnectors(groupId, "in" + inputNo));
                if (conns.length != 1) return false;
                if (!traverse(conns[0].from.id, baseNo + offset))
                    return false;
                offset += groupSize;
            }
            return true;
        } else if (groupDev.type == "EqConst") {
            return handleConst(groupDev.constant, (groupDev.bits || {}).in, Object.values(model.inputConnectors(groupId)));
        } else if (groupDev.type == "NorReduce") {
            return handleConst(0, groupDev.bits, Object.values(model.inputPortConnectors(groupId, "in")));
        } else if (groupDev.type == "OrReduce") {
            const constInConnList = Object.values(model.inputPortConnectors(groupId, "in"));
            if (constInConnList.length != 1) return false;
            const prevId = constInConnList[0].from.id;
            const prevDev = model.getDevice(prevId);
            if (prevDev.type != "BusGroup") return false;
            groupIds.push(prevId);
            if (!(groupDev.groups || []).every(x => x == 1)) return false;
            for (const conn of Object.values(model.inputConnectors(prevId))) {
                if (!traverse(conn.from.id, baseNo)) return false;
            }
            return true;
        } else return false;
    }
    if (!traverse(selConnList[0].from.id, 1))
        return false;
    const muxInputs = {};
    for (let n = 0; n <= dev.bits.sel; n++)
        muxInputs[n] = Object.values(model.inputPortConnectors(id, "in" + n));
    if (srcsignal == undefined) return false;
    if (bits > 9) return false;
    if (bits > 6 || Object.entries(mapping).length < 2**(dev.bits-1))
        sparse = true;
    const outConnList = Object.values(model.outputPortConnectors(id, "out"));
    model.removeDevice(id);
    for (const groupId of groupIds) {
        const constOutConnList = Object.values(model.outputConnectors(groupId));
        if (constOutConnList.length == 0)
            model.removeDevice(groupId);
    }
    const newDev = util.cloneDeep(dev);
    newDev.bits = newDev.bits || {};
    newDev.bits.sel = bits;
    newDev.type = sparse ? "MuxSparse" : "Mux";
    if (sparse) {
        newDev.inputs = Object.keys(mapping).map(x => BigInt(x)).sort((a, b) => a > b || -(a < b));
        newDev.default_input = !muxInputs[0].every(conn => {
            const inDev = model.getDevice(conn.from.id);
            if (inDev.type != "Constant") return false;
            const val = Vector3vl.fromBin(inDev.constant, bits);
            return val.xmask().isHigh;
        });
    }
    model.addDevice(newDev, id);
    model.addConnector({ from: srcsignal.from, to: selConnList[0].to }, [srcsignal, selConnList[0]]);
    for (const conn of outConnList)
        model.addConnector(conn);
    if (sparse) {
        for (const [n, constant] of Object.entries(newDev.inputs)) {
            const new_n = newDev.default_input ? Number(n) + 1 : n;
            for (const conn of muxInputs[mapping[constant]])
                model.addConnector({ from: conn.from, to: { id: id, port: 'in'+new_n }}, [conn]);
        }
        if (newDev.default_input)
            for (const conn of muxInputs[0])
                model.addConnector({ from: conn.from, to: { id: id, port: 'in0' }}, [conn]);
    } else {
        for (let n = 0; n < 2 ** bits; n++) {
            const inputNo = n in mapping ? mapping[n] : 0;
            for (const conn of muxInputs[inputNo])
                model.addConnector({ from: conn.from, to: { id: id, port: 'in'+n }}, [conn]);
        }
    }
    for (const conn of muxInputs[0]) {
        if (Object.values(model.outputConnectors(conn.from.id)).length == 0)
            model.removeDevice(conn.from.id);
    }
    return true;
}

export function makeDffWithEnable(model, dev, id)
{
    if (dev.type != "Dff") return false;
    if ("enable" in (dev.polarity || {})) return false;
    const inConnList = Object.values(model.inputPortConnectors(id, "in"));
    if (inConnList.length != 1) return false;
    const preId = inConnList[0].from.id;
    const preDev = model.getDevice(preId);
    if (preDev.type != "Mux") return false;
    if ((preDev.bits || {sel: 1}).sel != 1) return false;
    if (Object.values(model.outputPortConnectors(preId, "out")).length != 1) return false;
    const in0ConnList = Object.values(model.inputPortConnectors(preId, "in0"));
    const in1ConnList = Object.values(model.inputPortConnectors(preId, "in1"));
    function help(loopConnList, dffInConnList, polarity) {
        if (loopConnList.length != 1) return false;
        if (loopConnList[0].from.id != id) return false;
        if (loopConnList[0].from.port != "out") return false;
        if (!("polarity" in dev)) dev.polarity = {};
        dev.polarity.enable = polarity;
        const selConnList = Object.values(model.inputPortConnectors(preId, "sel"));
        model.removeDevice(preId);
        for (const conn of dffInConnList)
            model.addConnector({ from: conn.from, to: { id: id, port: "in" } }, [conn]);
        for (const conn of selConnList)
            model.addConnector({ from: conn.from, to: { id: id, port: "en" }}, [conn]);
        return true;
    }
    return help(in0ConnList, in1ConnList, true)
        || help(in1ConnList, in0ConnList, false);
}

export const transformations = [removeRepeater, integrateNegation, integrateArithConstant, makeNAryGates, makeBinaryMuxes, makeDffWithEnable];

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
        this._devices[id] = util.cloneDeep(dev);
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
    addConnector(conn, fromConns = []) {
        console.assert(conn.from.id in this._devices);
        console.assert(conn.to.id in this._devices);
        if (!('name' in conn)) {
            for (const conn2 of fromConns)
                if ('name' in conn2) {
                    conn.name = conn2.name;
                    break;
                }
        }
        if (!conn.source_positions) {
            conn.source_positions = [];
            for (const conn2 of fromConns)
                if (conn2.source_positions)
                    conn.source_positions.push(...conn2.source_positions);
        }
        const id = this._freshConnectorId();
        this._connectors[id] = util.cloneDeep(conn);
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
    return ret;
}


