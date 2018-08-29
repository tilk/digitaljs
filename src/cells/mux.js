"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';

// Multiplexers
joint.shapes.digital.Gate.define('digital.GenMux', {
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
        const size = { width: 40, height: (n_ins+1)*16+8+4 };
        _.set(args, ['attrs', '.body', 'points'], 
            [[0,20],[40,30],[40,size.height-10],[0,size.height]]
                .map(x => x.join(',')).join(' '));
        args.size = size;
        const markup = [];
        for (const num of Array(n_ins).keys()) {
            const y = num*16+12;
            markup.push(this.addWire(args, 'left', y, { id: 'in' + num, dir: 'in', bits: args.bits.in }));
        }
        markup.push(this.addWire(args, 'top', 0.5, { id: 'sel', dir: 'in', bits: args.bits.sel }));
        markup.push(this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.in }));
        _.set(args, ['attrs', 'circle.port_sel', 'ref-y'], -10);  // hack
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
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
        this.listenTo(this, 'change:inputSignals', (_, data) => {
            const i = this.muxInput(data.sel);
            for (const num of Array(n_ins).keys()) {
                this.attr('text.arrow_in' + num + '/visibility', i == num ? 'visible' : 'hidden');
            }
        });
    },
    operation: function(data) {
        const i = this.muxInput(data.sel);
        if (i === undefined) return { out: Array(this.get('bits').in).fill(0) };
        return { out: data['in' + this.muxInput(data.sel)] };
    }
});

// Multiplexer with binary selection
joint.shapes.digital.GenMux.define('digital.Mux', {
}, {
    muxNumInputs: n => 1 << n,
    muxInput: i => i.some(x => x == 0) ? undefined : help.sig2bigint(i).toString()
});

// Multiplexer with one-hot selection
joint.shapes.digital.GenMux.define('digital.Mux1Hot', {
}, {
    muxNumInputs: n => n + 1,
    muxInput: i => i.some(x => x == 0) || i.filter(x => x == 1).length > 1
        ? undefined : String(i.indexOf(1)+1)
});

