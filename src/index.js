"use strict";

import joint from 'jointjs';
import _ from 'lodash';
import Backbone from 'backbone';
import './joint.js';
import './style.css';
    
function getCellType(tp) {
    const types = {
        '$and': joint.shapes.digital.And,
        '$or': joint.shapes.digital.Or,
        '$xor': joint.shapes.digital.Xor,
        '$not': joint.shapes.digital.Not,
        '$button': joint.shapes.digital.Button
    };
    if (tp in types) return types[tp];
    else return null; // TODO
}
    
export class Circuit {
    constructor(data) {
        this.queue = new Set();
        this.graph = this.makeGraph(data);
        this.interval = setInterval(() => this.updateGates(), 10);
    }
    displayOn(elem) {
        const paper = new joint.dia.Paper({
            el: elem,
            model: this.graph,
            width: 1000, height: 600, gridSize: 5,
            snapLinks: true,
            linkPinning: false,
            defaultLink: new joint.shapes.digital.Wire,
            validateConnection: function(vs, ms, vt, mt, e, vl) {
                if (e === 'target') {
                    if (!mt || !$(mt).hasClass('in'))
                        return false;
                    const link = this.model.getConnectedLinks(vt.model).find((l) =>
                        l.id !== vl.model.id &&
                        l.get('target').id === vt.model.id &&
                        l.get('target').port === mt.getAttribute('port')
                    );
                    return !link;
                } else {
                    return true;
                }
            }
        });
        this.graph.resetCells(this.graph.getCells());
        return paper;
    }
    makeGraph(data) {
        const graph = new joint.dia.Graph();
        for (const dev of data.devices) {
            const cellType = getCellType(dev.type);
            const cell = new cellType({ id: dev.id });
            if ('label' in dev) cell.setLabel(dev.label);
            graph.addCell(cell);
            this.queue.add(dev.id);
        }
        for (const conn of data.connectors) {
            const src = conn.from.split('.');
            const tgt = conn.to.split('.');
            graph.addCell(new joint.shapes.digital.Wire({
                source: {id: src[0], port: src[1]},
                target: {id: tgt[0], port: tgt[1]},
            }));
        }
        joint.layout.DirectedGraph.layout(graph, {
            nodeSep: 20,
            edgeSep: 30,
            rankSep: 90,
            rankDir: "LR"
        });
        this.listenTo(graph, 'change:signal', function(wire, signal) {
            this.queue.add(wire.get('target').id);
        });
        this.listenTo(graph, 'change:portSignals', function(gate, sigs) {
            _.chain(this.graph.getConnectedLinks(gate, {outbound: true}))
                .groupBy((wire) => wire.get('source').port)
                .forEach((wires, port) => 
                    wires.forEach((wire) => wire.set('signal', sigs[port])))
                .value();
        });
        return graph;
    }
    updateGates() {
        const q = this.queue;
        this.queue = new Set();
        for (const gname of q) {
            const gate = this.graph.getCell(gname);
            if (!gate) continue;
            const args = _.chain(this.graph.getConnectedLinks(gate, {inbound: true}))
                .groupBy((wire) => wire.get('target').port)
                .mapValues((wires) => wires[0].get('signal'))
                .value();
            for (const pname in gate.ports) {
                if (!(pname in args)) args[pname] = 0;
            }
            const sigs = gate.operation(args);
            gate.set('portSignals', sigs);
        }
    }
};

_.extend(Circuit.prototype, Backbone.Events);

