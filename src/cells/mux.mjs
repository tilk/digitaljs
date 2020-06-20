"use strict";

import * as joint from 'jointjs';
import _ from 'lodash';
import { Gate, GateView, portGroupAttrs } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
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
                    'line.wire': { x2: 0, y2: -20 },
                    port: { magnet: 'passive', refY: -20 },
                    'text.bits': { refDx: -5, refDy: 2, textAnchor: 'start' }
                }),
                z: -1
            }
        }
    }
}, {
    initialize: function() {
        Gate.prototype.initialize.apply(this, arguments);
        
        const bits = this.get('bits');
        
        this.addPorts([
            { id: 'sel', group: 'in2', dir: 'in', bits: bits.sel },
            { id: 'out', group: 'out', dir: 'out', bits: bits.in }
        ]);
        
        this.on('change:size', (_, size) => {
            this.attr(['polygon.body', 'points'], 
            [[0,0],[size.width,10],[size.width,size.height-10],[0,size.height]]
                .map(x => x.join(',')).join(' '));
        });
        const n_ins = this.muxNumInputs(bits.sel);
        this.prop('size/height', n_ins*16+8);
        
        const vpath = [
            [2, 0],
            [5, 5],
            [11, -5]
        ];
        const path = 'M' + vpath.map(l => l.join(' ')).join(' L');
        
        for (const num of Array(n_ins).keys()) {
            this.addPort({ id: 'in' + num, group: 'in', dir: 'in', bits: bits.in, decor: path });
        }
    },
    operation: function(data) {
        const i = this.muxInput(data.sel);
        if (i === undefined) return { out: Vector3vl.xes(this.get('bits').in) };
        return { out: data['in' + i] };
    },
    //add offset of 20pt to account for the top selection port at layout time
    getLayoutSize: function() {
        const size = this.size();
        size.height += 20;
        return size;
    },
    setLayoutPosition: function(position) {
        this.set('position', {
            x: position.x - position.width / 2,
            y: position.y - position.height / 2 + 20
        });
    },
    markup: Gate.prototype.markup.concat([{
            tagName: 'polygon',
            className: 'body'
        }
    ]),
    gateParams: Gate.prototype.gateParams.concat(['bits']),
    unsupportedPropChanges: Gate.prototype.unsupportedPropChanges.concat(['bits'])
});
export const GenMuxView = GateView.extend({
    initialize() {
        this.n_ins = this.model.muxNumInputs(this.model.get('bits').sel);
        GateView.prototype.initialize.apply(this, arguments);
    },
    confirmUpdate(flags) {
        GateView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'flag:inputSignals')) {
            this.updateMux(this.model.get('inputSignals'));
        }
    },
    render() {
        GateView.prototype.render.apply(this, arguments);
        this.updateMux(this.model.get('inputSignals'));
    },
    updateMux(data) {
        const i = this.model.muxInput(data.sel);
        for (const num of Array(this.n_ins).keys()) {
            this.$('[port=in' + num + '] path.decor').css('visibility', i == num ? 'visible' : 'hidden');
        }
    }
});

// Multiplexer with binary selection
export const Mux = GenMux.define('Mux', {
}, {
    muxNumInputs: n => 1 << n,
    muxInput: i => i.isFullyDefined ? help.sig2bigint(i).toString() : undefined
});
export const MuxView = GenMuxView;

// Multiplexer with one-hot selection
export const Mux1Hot = GenMux.define('Mux1Hot', {
}, {
    muxNumInputs: n => n + 1,
    muxInput: s => {
        const i = s.toArray();
        return s.isFullyDefined && i.filter(x => x == 1).length <= 1
            ? String(i.indexOf(1)+1) : undefined
    }
});
export const Mux1HotView = GenMuxView;

