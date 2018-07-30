"use strict";

import joint from 'jointjs';
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
    
function makeGraph(data) {
    const graph = new joint.dia.Graph();
    for (const dev of data.devices) {
        const cellType = getCellType(dev.type);
        const cell = new cellType({ id: dev.id });
        graph.addCell(cell);
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
    return graph;
}

export class Circuit {
    constructor(data) {
        this.graph = makeGraph(data);
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
                    if (!mt || !$(mt).hasClass('input'))
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
};

