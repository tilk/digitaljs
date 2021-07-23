"use strict";

import * as joint from 'jointjs';
import _ from 'lodash';
import { Gate, GateView, portGroupAttrs } from './base';
import * as help from '../help';
import { Vector3vl } from '3vl';

// Multiplexers
export const GenMux = Gate.define('GenMux', {
    /* default properties */
    bits: { in: 1, sel: 1 },
    
    size: { width: 40, height: undefined },
    ports: {
        groups: {
            'in2': {
                position: { name: 'top', args: { y: 5 } },
                attrs: _.merge({}, portGroupAttrs, {
                    wire: { x2: 0, y2: -25 },
                    port: { magnet: 'passive', refY: -25 },
                    bits: { refDx: -5, refDy: 2, textAnchor: 'start' }
                }),
                z: -1
            }
        }
    },
    attrs: { label: { refDy: 8 } }
}, {
    initialize() {
        const bits = this.get('bits');
        const ports = [
            { id: 'sel', group: 'in2', dir: 'in', bits: bits.sel },
            { id: 'out', group: 'out', dir: 'out', bits: bits.in }
        ];
        
        const ins = this.muxInputs(bits.sel);
        this.get('size').height = ins.length*16+8;
        
        const vpath = [
            [2, 0],
            [5, 5],
            [10, -5]
        ];
        const path = 'M' + vpath.map(l => l.join(' ')).join(' L');
        
        for (const [num, label] of ins.entries()) {
            const port = { id: 'in' + num, group: 'in', dir: 'in', bits: bits.in, decor: path };
            if (label) {
                port.portlabel = String(label);
                port.labelled = true;
            }
            ports.push(port);
        }
        
        this.get('ports').items = ports;
        
        Gate.prototype.initialize.apply(this, arguments);
        
        const drawBorder = (size) => this.attr(['body', 'points'], 
            [[0,-5],[size.width,5],[size.width,size.height-5],[0,size.height+5]]
                .map(x => x.join(',')).join(' '));
        drawBorder(this.get('size'));
        
        this.on('change:size', (_, size) => drawBorder(size));
    },
    operation(data) {
        const i = this.muxInput(data.sel);
        if (i === undefined) return { out: Vector3vl.xes(this.get('bits').in) };
        return { out: data['in' + i] };
    },
    //add offset of 30pt to account for the top selection port and oversized box at layout time
    getLayoutSize() {
        const size = this.size();
        size.height += 30;
        return size;
    },
    setLayoutPosition(position) {
        this.set('position', {
            x: position.x - position.width / 2,
            y: position.y - position.height / 2 + 20
        });
    },
    markup: Gate.prototype.markup.concat([{
            tagName: 'polygon',
            className: 'body',
            selector: 'body'
        }
    ]),
    _gateParams: Gate.prototype._gateParams.concat(['bits']),
    _unsupportedPropChanges: Gate.prototype._unsupportedPropChanges.concat(['bits'])
});
export const GenMuxView = GateView.extend({
    initialize() {
        this.ins = this.model.muxInputs(this.model.get('bits').sel);
        GateView.prototype.initialize.apply(this, arguments);
    },
    confirmUpdate(flags) {
        GateView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'SIGNAL')) {
            this._updateMux(this.model.get('inputSignals'));
        }
    },
    render() {
        GateView.prototype.render.apply(this, arguments);
        this._updateMux(this.model.get('inputSignals'));
    },
    _updateMux(data) {
        const i = this.model.muxInput(data.sel);
        for (const num of this.ins.keys()) {
            this.$('[port=in' + num + '] path.decor').css('visibility', i == num ? 'visible' : 'hidden');
        }
    }
});

// Multiplexer with binary selection
export const Mux = GenMux.define('Mux', {
}, {
    muxInputs: n => Array(1 << n),
    muxInput: i => i.isFullyDefined ? i.toBigInt().toString() : undefined
});
export const MuxView = GenMuxView;

// Multiplexer with one-hot selection
export const Mux1Hot = GenMux.define('Mux1Hot', {
    attrs: {
        info: {
            refX: .5, refY: .5,
            textAnchor: 'middle', textVerticalAnchor: 'middle',
            text: '1Hot',
            transform: 'rotate(90)'
        }
    }
}, {
    markup: GenMux.prototype.markup.concat([{
            tagName: 'text',
            className: 'info',
            selector: 'info'
        }
    ]),
    muxInputs: n => Array(n + 1),
    muxInput: s => {
        const i = s.toArray();
        return s.isFullyDefined && i.filter(x => x == 1).length <= 1
            ? String(i.indexOf(1)+1) : undefined
    }
});
export const Mux1HotView = GenMuxView;

export const MuxSparse = GenMux.define('MuxSparse', {
    /* default properties */
    inputs: undefined
}, {
    initialize() {
        const inputs = this.get('inputs');
        for (let i = 0; i < inputs.length; i++)
            if (typeof inputs[i] != 'bigint')
                inputs[i] = BigInt(inputs[i]);
        GenMux.prototype.initialize.apply(this, arguments);
    },
    muxInputs(n) {
        return this.get('inputs');
    },
    muxInput(i) {
        if (!i.isFullyDefined) return undefined;
        const idx = this.get('inputs').indexOf(i.toBigInt());
        return idx < 0 ? undefined : idx;
    },
    _gateParams: GenMux.prototype._gateParams.concat(['inputs']),
    _unsupportedPropChanges: GenMux.prototype._unsupportedPropChanges.concat(['inputs'])
});
export const MuxSparseView = GenMuxView;

