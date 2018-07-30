"use strict";

import joint from 'jointjs';
import './style.css';
    
function getCellType(tp) {
    const types = {
        '$and': joint.shapes.logic.And,
        '$or': joint.shapes.logic.Or,
        '$xor': joint.shapes.logic.Xor,
        '$not': joint.shapes.logic.Not
    };
    if (tp in types) return types[tp];
    else return null; // TODO
}
    
function makeGraph(data) {
    const graph = new joint.dia.Graph();
    for (const dev of data.devices) {
        const cellType = getCellType(dev.type);
        const cell = new cellType({ position: {x: 0, y: 0} });
        graph.addCell(cell);
    }
    joint.layout.DirectedGraph.layout(graph, {
        nodeSep: 20,
        edgeSep: 30,
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
            defaultLink: new joint.shapes.logic.Wire,
            validateConnection: function(vs, ms, vt, mt, e, vl) {
                return true;
            }
        });
        this.graph.resetCells(this.graph.getCells());
        return paper;
    }
};

