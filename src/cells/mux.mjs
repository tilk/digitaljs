"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { Vector3vl } from '3vl';

// Multiplexers
export const GenMux = Gate.define('GenMux', {
    attrs: {
        "rect.wtf": {
            y: -4, width: 40, height: 1, visibility: 'hidden'
        },
        "text.arrow": {
            text: '✔', 'y-alignment': 'middle', fill: 'black',
            visibility: 'hidden'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in: 1, sel: 1 };
        const n_ins = this.muxNumInputs(args.bits.sel);
        const size = { width: 40, height: n_ins*16+8 };
        _.set(args, ['attrs', '.body', 'points'], 
            [[0,0],[40,10],[40,size.height-10],[0,size.height]]
                .map(x => x.join(',')).join(' '));
        args.size = size;
        const markup = [];
        for (const num of Array(n_ins).keys()) {
            const y = num*16+12;
            markup.push(this.addWire(args, 'left', y, { id: 'in' + num, dir: 'in', bits: args.bits.in }));
        }
        markup.push(this.addWire(args, 'top', 0.5, { id: 'sel', dir: 'in', bits: args.bits.sel }));
        markup.push(this.addWire(args, 'right', (size.height)/2, { id: 'out', dir: 'out', bits: args.bits.in }));
        markup.push('<polygon class="body"/><rect class="wtf"/><text class="label"/>');
        for (const num of Array(n_ins).keys()) {
            const y = num*16+12;
            markup.push('<text class="arrow arrow_in' + num + '" />');
            args.attrs['text.arrow_in' + num] = {
                'ref-x': 2,
                'ref-y': y,
            };
        }
        this.markup = markup.join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const i = this.muxInput(data.sel);
        if (i === undefined) return { out: Vector3vl.xes(this.get('bits').in) };
        return { out: data['in' + i] };
    },
    gateParams: Gate.prototype.gateParams.concat(['bits'])
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
            this.$('text.arrow_in' + num).css('visibility', i == num ? 'visible' : 'hidden');
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

