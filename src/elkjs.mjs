
import elkjs from 'elkjs/lib/elk.bundled.js';
import { Clock, Input, Output } from "./cells/io.mjs";

function to_elkjs(graph) {
    const elkGraph = {
        id: "root",
        properties: {
            algorithm: 'layered',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.layered.spacing.nodeNodeBetweenLayers': 40.0,
            'elk.layered.nodePlacement.favorStraightEdges': true,
        },
        children: [],
        edges: []
    };
    for (const cell of graph.getCells()) {
        if (cell.isLink()) {
            var source = cell.get('source');
            var target = cell.get('target');
            if (!source.id || !target.id) break;

            elkGraph.edges.push({
                id: cell.id,
                sources: [ source.id + '.' + source.port ],
                targets: [ target.id + '.' + target.port ]
            });
        } else {
            const size = cell.getLayoutSize();

            const ppos = {};

            const ports = cell.getPorts().map((p, i) => {
                if (!ppos[p.group])
                    ppos[p.group] = cell.getPortsPositions(p.group);
                return {
                    id: cell.id + "." + p.id,
                    x: ppos[p.group][p.id].x,
                    y: ppos[p.group][p.id].y,
                    properties: {
                        'port.side': p.group == "in" ? "WEST" : p.group == "in2" ? "NORTH" : "EAST",
                        'port.borderOffset': 30,
                        'port.index': -i
                    }
                };
            });

            elkGraph.children.push({
                id: cell.id,
                width: size.width,
                height: size.height,
                ports: ports,
                properties: {
                    portConstraints: 'FIXED_POS',
                    layerConstraint: (cell instanceof Input || cell instanceof Clock) ? "FIRST" 
                                                             : cell instanceof Output ? "LAST" : "NONE"
                }
            });
        }
    }
    return elkGraph;
}

function from_elkjs(graph, elkGraph) {
    for (const child of elkGraph.children) {
        const cell = graph.getCell(child.id);
        cell.setLayoutPosition({
            x: child.x,
            y: child.y,
            width: child.width,
            height: child.height
        });
    }
    const corner_dist = 10;
    for (const edge of elkGraph.edges) {
        const bps = edge.sections[0].bendPoints;
        if (!bps)
            continue;
        // elkjs gives us a bunch of points to create straight edges.
        // This causes JointJS to overshot and create strange shape due to rounded corners.
        // Instead, we split each corner point to two points, each shifted towards
        // the center of the edge by a little to give JointJS enough space
        // to make its round corners.
        let is_first = true;
        let last_point = edge.sections[0].startPoint;
        const vertices = [];
        const add_point = (bp, is_last) => {
            if (bp.x == last_point.x) {
                let edgelen = Math.abs(bp.y - last_point.y);
                let shift = bp.y > last_point.y ? corner_dist : -corner_dist;
                if (edgelen > 2 * corner_dist) {
                    is_first || vertices.push({x: last_point.x, y: last_point.y + shift});
                    is_last || vertices.push({x: bp.x, y: bp.y - shift});
                }
                else if (edgelen > 2 * corner_dist && !is_first && !is_last) {
                    vertices.push({x: bp.x, y: (bp.y + last_point.y) / 2});
                }
            }
            else if (bp.y == last_point.y) {
                let edgelen = Math.abs(bp.x - last_point.x);
                let shift = bp.x > last_point.x ? corner_dist : -corner_dist;
                if (edgelen > 2 * corner_dist) {
                    is_first || vertices.push({x: last_point.x + shift, y: last_point.y});
                    is_last || vertices.push({x: bp.x - shift, y: bp.y});
                }
                else if (edgelen > 2 * corner_dist && !is_first && !is_last) {
                    vertices.push({x: (bp.x + last_point.x) / 2, y: bp.y});
                }
            }
            else if (!is_last) {
                vertices.push({x: bp.x, y: bp.y});
            }
            last_point = bp;
            is_first = false;
        };
        for (const bp of bps)
            add_point(bp, false);
        // use the end point to finish the last bend point without adding the end point itself.
        add_point(edge.sections[0].endPoint, true);
        graph.getCell(edge.id).vertices(vertices);
    }
}

export function elk_layout(graph) {
    const elkGraph = to_elkjs(graph);

    const elk = new elkjs();

    elk.layout(elkGraph).then(g => {
        from_elkjs(graph, g);
    });
}

